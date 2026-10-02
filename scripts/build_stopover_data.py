#!/usr/bin/env python3
"""Build the stopover page's offline demand + aircraft data files (ATL-148).

One-off codegen, committed for reproducibility. Source: the public MIT-licensed
abc8747/am4 dataset (am4 game data — route demand, aircraft specs).

Outputs (all under data/):
  stopover-demand.bin.gz   - y/j/f uint16 LE per airport pair, indexed by the
                             page's own DB order (pair idx formula below).
  stopover-airports.json   - ordered ICAO list matching the page's DB order.
  stopover-aircrafts.json  - spec table for the dropdown (pax list from
                             config.js AIRCRAFT_DATA + the alliance freighters).

Verification: asserts all 9 am4help reference cases from the ATL-148 work order.
"""

import gzip
import json
import math
import re
import struct
import sys
from pathlib import Path

import pyarrow.parquet as pq

REPO = Path(__file__).resolve().parent.parent
AM4 = Path.home() / "am4" / "src" / "am4" / "utils" / "data"
OUT = REPO / "data"

LOAD = 0.94           # assumed load factor (reproduces the am4help screenshots)
INCOME_LOSS_TOL = 0.02  # am4 default


# ── DB extraction ────────────────────────────────────────────────────────────
def page_db():
    html = (REPO / "public" / "stopover.html").read_text()
    m = re.search(r"const DB = (\[.*?\]);", html, re.S)
    return json.loads(m.group(1))


def pair_idx(a, b, n):
    """Undirected pair index, same formula as am4's get_dbroute_idx."""
    if a > b:
        a, b = b, a
    return (a * (2 * n - a - 1) // 2) + b - a - 1


# ── demand table ─────────────────────────────────────────────────────────────
def build_demand(db, am4_dir):
    ap = pq.read_table(am4_dir / "airports.parquet").to_pydict()
    their_idx = {icao.upper(): i for i, icao in enumerate(ap["icao"])}
    ours_theirs = []
    for row in db:
        icao = row[1]
        if icao not in their_idx:
            raise SystemExit(f"airport missing from am4 dataset: {icao} ({row[0]})")
        ours_theirs.append(their_idx[icao])

    routes = pq.read_table(am4_dir / "routes.parquet").to_pydict()
    n, nt = len(db), len(ap["icao"])
    buf = bytearray(n * (n - 1) // 2 * 6)
    for i in range(n):
        ti = ours_theirs[i]
        for j in range(i + 1, n):
            tj = ours_theirs[j]
            r = pair_idx(ti, tj, nt)
            struct.pack_into("<HHH", buf, pair_idx(i, j, n) * 6,
                             routes["yd"][r], routes["jd"][r], routes["fd"][r])
        if i % 500 == 0:
            print(f"  demand {i}/{n}", flush=True)
    return buf


# ── aircraft specs ───────────────────────────────────────────────────────────
# Display name -> parquet name. Pax list mirrors config.js AIRCRAFT_DATA;
# freighters are the two the alliance flies (aircraft.cpp type==1).
AIRCRAFT = [
    ("B737-800", "B737-800"), ("B737 MAX 8", "B737 MAX 8"),
    ("A330-200", "A330-200"), ("A330-300", "A330-300"),
    ("A330-800neo", "A330-800neo"), ("A330-900neo", "A330-900neo"),
    ("A340-300", "A340-300"), ("A340-600", "A340-600"),
    ("A350-900", "A350-900"), ("A350-900R", "A350-900R"),
    ("A380-800", "A380-800"), ("B747SP", "B747SP"),
    ("B777-200", "B777-200"), ("B787-8", "B787-8"),
    ("B787-9", "B787-9"), ("B787-10", "B787-10"),
    ("Il-96-400", "Il-96-400"), ("MC-21-400", "MC-21-400"),
    ("A380F", "A380-800F"), ("B747-8F", "B747-8F"),
]


def build_aircrafts(am4_dir):
    t = pq.read_table(am4_dir / "aircrafts.parquet").to_pydict()
    # priority 0 = best engine variant per type
    best = {}
    for i, name in enumerate(t["name"]):
        if t["priority"][i] == 0:
            best[name] = i
    out = []
    for disp, key in AIRCRAFT:
        i = best[key]
        speed = t["speed"][i]
        out.append({
            "name": disp,
            "cat": "cargo" if t["type"][i] == 1 else "pax",
            "cap": t["capacity"][i],
            "rwy": t["rwy"][i],
            "range": t["range"][i],
            "realism": round(speed * 1.1),   # +10% speed mod assumed fitted
            "easy": round(speed * 1.65),     # +10% then easy-mode x1.5
        })
    return out


# ── algorithm port for self-verification (mirrors lib stopoverData + page JS) ──
def fill(dpf, cap, order):
    s1, s2, s3 = order
    space = {"y": 1, "j": 2, "f": 3}
    c = {}
    rem = cap
    for k in (s1, s2):
        c[k] = min(dpf[k], rem // space[k])
        rem -= c[k] * space[k]
    c[s3] = rem // space[s3]
    c["valid"] = c[s3] < dpf[s3]
    return c


PAX_ORDER = {"FJY": ("f", "j", "y"), "FYJ": ("f", "y", "j"), "JFY": ("j", "f", "y"),
             "JYF": ("j", "y", "f"), "YFJ": ("y", "f", "j"), "YJF": ("y", "j", "f")}


def pax_order(direct, easy):
    if easy:
        if direct < 14425: return "FJY"
        if direct < 14812.5: return "FYJ"
        if direct < 15200: return "YFJ"
        return "YJF"
    if direct < 13888.8888: return "FJY"
    if direct < 15694.4444: return "JFY"
    if direct < 17500: return "JYF"
    return "YJF"


def opt_ticket(direct, easy):
    if easy:
        return (int(1.10 * (0.4 * direct + 170)) - 2,
                int(1.08 * (0.8 * direct + 560)) - 2,
                int(1.06 * (1.2 * direct + 1200)) - 2)
    return (int(1.10 * (0.3 * direct + 150)) - 2,
            int(1.08 * (0.6 * direct + 500)) - 2,
            int(1.06 * (0.9 * direct + 1000)) - 2)


def best_pax(dem, cap, speed, flown, direct, easy=False):
    la = {k: int(dem[k] / LOAD) for k in "yjf"}
    order = PAX_ORDER[pax_order(direct, easy)]
    ty, tj, tf = opt_ticket(direct, easy)

    def calc(t):
        dpf = {k: int(la[k] / t) for k in "yjf"}
        return fill(dpf, cap, order)

    ft = flown / speed
    tpdpa = min(math.floor(24 / ft), math.floor((la["y"] + 2 * la["j"] + 3 * la["f"]) / cap))
    cfg = calc(tpdpa)
    while not cfg["valid"]:
        tpdpa -= 1
        if tpdpa <= 0:
            return None
        cfg = calc(tpdpa)
    income = cfg["y"] * ty + cfg["j"] * tj + cfg["f"] * tf
    bound = income * (1 - INCOME_LOSS_TOL)
    num_ac = 1
    for i in range(2, 200):
        ic = calc(tpdpa * i)
        if not ic["valid"]:
            break
        ii = ic["y"] * ty + ic["j"] * tj + ic["f"] * tf
        if ii < bound:
            break
        cfg, income, num_ac = ic, ii, i
    return cfg, tpdpa, num_ac


# ── main ─────────────────────────────────────────────────────────────────────
REFS = [
    ("VVNB", "SPIM", (1193, 222, 277), (317, 59, 55), 4),
    ("RPLL", "SGAS", (1077, 498, 161), (286, 132, 16), 4),
    ("MROC", "WIII", (1523, 477, 169), (324, 101, 24), 5),
    ("VMMC", "SGAS", (1881, 355, 167), (400, 75, 16), 5),
    ("ZGSZ", "SLLP", (1150, 463, 216), (305, 123, 16), 4),
    ("VMMC", "SCEL", (813, 812, 105), (216, 192, 0), 4),
    ("ZGSZ", "SCEL", (841, 639, 220), (223, 169, 13), 4),
    ("SCEL", "ZHHH", (1389, 220, 88), (492, 54, 0), 3),
    ("SVMI", "WIII", (966, 685, 309), (205, 145, 35), 5),
]


def hav_nm(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[6], a[7], b[6], b[7]))
    h = (math.sin((la2 - la1) / 2) ** 2
         + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    return 6371 * 2 * math.asin(math.sqrt(h))


def main():
    db = page_db()
    icao_idx = {r[1]: i for i, r in enumerate(db)}
    assert len(db) == 3907

    buf = build_demand(db, AM4)
    OUT.mkdir(exist_ok=True)
    (OUT / "stopover-demand.bin.gz").write_bytes(gzip.compress(bytes(buf), 9))
    (OUT / "stopover-airports.json").write_text(
        json.dumps([r[1] for r in db], separators=(",", ":")))
    aircrafts = build_aircrafts(AM4)
    (OUT / "stopover-aircrafts.json").write_text(json.dumps(aircrafts, indent=1) + "\n")

    gz_size = (OUT / "stopover-demand.bin.gz").stat().st_size
    print(f"demand.bin {len(buf)} B -> .gz {gz_size} B "
          f"({gz_size/1e6:.1f} MB), {len(aircrafts)} aircraft")

    a388 = next(a for a in aircrafts if a["name"] == "A380-800")
    n = len(db)
    fails = 0
    for fa, ta, dem, cfg, tpd in REFS:
        i, j = icao_idx[fa], icao_idx[ta]
        y, jv, f = struct.unpack_from("<HHH", buf, pair_idx(i, j, n) * 6)
        direct = hav_nm(db[i], db[j])
        # A388 realism flown distance ~ direct (refs are direct routes)
        res = best_pax({"y": y, "j": jv, "f": f}, a388["cap"], a388["realism"],
                       direct, direct)
        got = (y, jv, f)
        got_cfg = (res[0]["y"], res[0]["j"], res[0]["f"]) if res else None
        got_tpd = res[1] * res[2] if res else None
        ok = got == dem and got_cfg == cfg and got_tpd == tpd
        print(f"{fa}->{ta}: dem {got} cfg {got_cfg} tpd {got_tpd} "
              f"{'OK' if ok else f'FAIL want dem={dem} cfg={cfg} tpd={tpd}'}")
        fails += 0 if ok else 1
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
