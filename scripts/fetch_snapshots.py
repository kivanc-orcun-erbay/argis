"""Download the real NASA / SoilGrids data embedded in index.html for the four preset regions.

Usage (from the project folder):
    python3 scripts/fetch_snapshots.py            # all regions
    python3 scripts/fetch_snapshots.py harran     # one region
    python3 scripts/embed_snapshots.py            # then put data/snapshots.json into index.html

Each part is saved under data/raw/<region>_<part>.json and reused on the next run, so a
failed or interrupted download resumes where it stopped. Delete a file to download it again.

Sources (no API keys):
- NASA POWER monthly point data, 2001-END_Y (T2M, PRECTOTCORR, GWETROOT, ...).
  POWER's monthly T2M_MAX / T2M_MIN are the month's extremes, so they are replaced with the
  mean of POWER daily highs / lows, which is what the crop limits assume (same as the page).
- SoilGrids 2.0 (ISRIC): pH, clay, organic carbon, mean of 0-30 cm.
- MODIS MOD13Q1 NDVI (ORNL DAAC), last ~5 years, with the pixel-reliability band
  (0 good, 1 marginal are kept by the page; cloudy/snow dates are dropped).
"""
import datetime, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data", "snapshots.json")

# Farmland points: SoilGrids has data and MODIS MCD12Q1 2025 land cover = 12 (cropland) at each.
SITES = {"konya": (37.56, 32.76), "cukurova": (36.92, 35.48), "harran": (36.95, 38.92), "trakya": (41.25, 27.15)}
PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "GWETROOT", "GWETTOP", "ALLSKY_SFC_SW_DWN"]
END_Y = 2025


def get(url, tries=8, timeout=90):
    """GET JSON with exponential backoff (MODIS is often slow; home connections drop)."""
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "fieldshift-snapshot"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except Exception as e:
            print("  retry", i + 1, url[:90], e, file=sys.stderr, flush=True)
            time.sleep(min(60, 5 * 2 ** i))
    raise RuntimeError("failed " + url)


def power(lat, lon):
    j = get(f"https://power.larc.nasa.gov/api/temporal/monthly/point?parameters={','.join(PARAMS)}&community=AG&longitude={lon}&latitude={lat}&start=2001&end={END_Y}&format=JSON")
    P = j["properties"]["parameter"]
    D = get(f"https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN&community=AG&longitude={lon}&latitude={lat}&start=20010101&end={END_Y}1231&format=JSON", timeout=120)["properties"]["parameter"]
    for k in ("T2M_MAX", "T2M_MIN"):
        acc = {}
        for day, v in D[k].items():
            if v is None or v == -999:
                continue
            a = acc.setdefault(day[:6], [0.0, 0]); a[0] += v; a[1] += 1
        for ym, (sm, c) in acc.items():
            if c >= 20 and ym in P[k]:
                P[k][ym] = sm / c
    out = {}
    for k in PARAMS:
        arr = []
        for y in range(2001, END_Y + 1):
            for m in range(1, 13):
                v = P.get(k, {}).get(f"{y}{m:02d}")
                arr.append(None if v is None or v == -999 else round(v, 3))
        out[k] = arr
    return {"y0": 2001, "y1": END_Y, "p": out}


def soil(lat, lon):
    j = get(f"https://rest.isric.org/soilgrids/v2.0/properties/query?lon={lon}&lat={lat}&property=phh2o&property=clay&property=soc&depth=0-5cm&depth=5-15cm&depth=15-30cm&value=mean")
    o = {}
    for L in j["properties"]["layers"]:
        df = L["unit_measure"].get("d_factor", 1) or 1
        vs = [d["values"]["mean"] for d in L["depths"] if d["values"]["mean"] is not None]
        o[L["name"]] = round(sum(vs) / len(vs) / df, 2) if vs else None
    return {"ph": o.get("phh2o"), "clay": o.get("clay"), "soc": o.get("soc")}


def ndvi(lat, lon):
    base = "https://modis.ornl.gov/rst/api/v1/MOD13Q1"
    dates = get(f"{base}/dates?latitude={lat}&longitude={lon}")["dates"][-23 * 5:]
    vals, rel = {}, {}
    jobs = [(band, store, dates[i:i + 10]) for band, store in (("250m_16_days_NDVI", vals), ("250m_16_days_pixel_reliability", rel)) for i in range(0, len(dates), 10)]

    def one(job):
        band, store, ch = job
        j = get(f"{base}/subset?latitude={lat}&longitude={lon}&band={band}&startDate={ch[0]['modis_date']}&endDate={ch[-1]['modis_date']}&kmAboveBelow=0&kmLeftRight=0")
        for s in j["subset"]:
            store[s["calendar_date"]] = s["data"][0]

    with ThreadPoolExecutor(2) as ex:  # MODIS struggles with more parallel requests
        list(ex.map(one, jobs))
    return [[d, None if vals[d] is None or vals[d] < -2000 else round(vals[d] * 0.0001, 4), rel.get(d)] for d in sorted(vals)]


def cached(name, fn):
    p = os.path.join(RAW, name + ".json")
    if os.path.exists(p):
        return json.load(open(p))
    v = fn()
    json.dump(v, open(p, "w"))
    return v


def main():
    os.makedirs(RAW, exist_ok=True)
    wanted = sys.argv[1:] or list(SITES)
    for k in wanted:
        lat, lon = SITES[k]
        print("site", k, file=sys.stderr, flush=True)
        for part, fn in (("power", power), ("soil", soil), ("ndvi", ndvi)):
            try:
                cached(f"{k}_{part}", lambda: fn(lat, lon))
            except Exception as e:
                print(f"  {part} failed: {e}", file=sys.stderr, flush=True)

    # Build data/snapshots.json from everything saved so far. POWER is required; soil and
    # NDVI are optional (the page says when they are missing).
    res, missing = {}, []
    for k, (lat, lon) in SITES.items():
        p = os.path.join(RAW, f"{k}_power.json")
        if not os.path.exists(p):
            missing.append(f"{k}_power"); continue
        date = datetime.date.fromtimestamp(os.path.getmtime(p)).isoformat()
        load = lambda part, default: json.load(open(os.path.join(RAW, f"{k}_{part}.json"))) if os.path.exists(os.path.join(RAW, f"{k}_{part}.json")) else (missing.append(f"{k}_{part}") or default)
        res[k] = {"lat": lat, "lon": lon, "fetched": date, "power": json.load(open(p)), "soil": load("soil", None), "ndvi": load("ndvi", [])}
    json.dump(res, open(OUT, "w"), separators=(",", ":"))
    print("wrote", os.path.relpath(OUT, ROOT), {k: (v["soil"] is not None, len(v["ndvi"])) for k, v in res.items()}, file=sys.stderr)
    if missing:
        print("missing:", ", ".join(missing), "(run again to retry)", file=sys.stderr)


if __name__ == "__main__":
    main()
