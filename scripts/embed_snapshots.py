"""Put data/snapshots.json into index.html's <script id="snapData"> block.

Usage (from the project folder):  python3 scripts/embed_snapshots.py
Then run: node tests/model.cjs && node tests/regions.cjs
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "data", "snapshots.json")
page = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "index.html")

snap = json.load(open(src))
for k, v in snap.items():
    assert v.get("power") and len(v["power"]["p"]["T2M"]) >= 12 * 20, f"{k}: POWER data missing"
data = json.dumps(snap, separators=(",", ":"), ensure_ascii=False)
assert "</" not in data
html = open(page).read()
pat = re.compile(r'(<script id="snapData" type="application/json">)(.*?)(</script>)', re.S)
assert len(pat.findall(html)) == 1, "snapData block not found exactly once"
open(page, "w").write(pat.sub(lambda m: m.group(1) + data + m.group(3), html))
print("embedded", {k: (v["soil"], len(v.get("ndvi") or [])) for k, v in snap.items()}, f"{len(data) / 1024:.0f} KB")
