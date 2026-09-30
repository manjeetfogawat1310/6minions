"""
weight_ai.py  --  SIRF hive weight predict karta hai.

Idea:
  - Farmer hafte mein ek baar hive ka weight (anchor) daalta hai.
  - AI Temperature / Humidity / Audio se roz ka weight CHANGE predict karta hai.
  - Current weight = anchor weight + (anchor ke baad ke saare daily changes ka sum)

Chalane ka tareeka:
  python prepare_data.py
  python weight_ai.py train
  python weight_ai.py predict --hive 2001 --date 2020-08-01 --weight 38.5
  python weight_ai.py predict --hive 2001 --date 2020-08-01 --weight 38.5 --until 2020-08-20
"""
import argparse
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import GroupKFold

from prepare_data import daily_features, load_sensors

DATA_CSV = "data/mspb_dataset_clean.csv"
MODEL_DIR = Path(__file__).resolve().parent / "app" / "services" / "models_ml"
MODEL_PATH = MODEL_DIR / "vs_weight.joblib"
NON_FEATURES = {"nectar_id", "date", "weight_kg", "d_weight", "yield_kg", "varroa",
                "health_score", "weight_source"}


def new_model():
    return HistGradientBoostingRegressor(max_depth=4, learning_rate=0.05, max_iter=300,
                                         min_samples_leaf=20, random_state=0)


# ---------------------------------------------------------------------------
# 1) TRAIN : T/H/A  ->  daily weight change (kg/day)
# ---------------------------------------------------------------------------
def train():
    df = pd.read_csv(DATA_CSV, parse_dates=["date"]).sort_values(["nectar_id", "date"]).reset_index(drop=True)
    feats = [c for c in df.columns if c not in NON_FEATURES]
    X, y, groups = df[feats], df["d_weight"], df["nectar_id"]
    source = df["weight_source"].iloc[0]

    n = min(5, groups.nunique())
    if n < 2:
        raise ValueError("Kam se kam 2 hives chahiye (hive-wise validation ke liye).")
    oof = np.full(len(df), np.nan)
    for tr, te in GroupKFold(n).split(X, y, groups):
        oof[te] = new_model().fit(X.iloc[tr], y.iloc[tr]).predict(X.iloc[te])

    tmp = pd.DataFrame({"h": groups.values, "y": y.values, "p": oof})
    tmp["y7"] = tmp.groupby("h")["y"].transform(lambda s: s.rolling(7).sum())
    tmp["p7"] = tmp.groupby("h")["p"].transform(lambda s: s.rolling(7).sum())
    ok = tmp.dropna()

    print("=" * 62)
    print(f"Weight-change model | {len(df)} rows | {groups.nunique()} hives | weight_source={source}")
    print(f"  Daily change MAE : {mean_absolute_error(y, oof):.3f} kg/day | R2 {r2_score(y, oof):.3f}"
          f" | baseline MAE {mean_absolute_error(y, np.full(len(y), y.median())):.3f}")
    if len(ok):
        print(f"  7-day change MAE : {mean_absolute_error(ok['y7'], ok['p7']):.3f} kg"
              f" | baseline {mean_absolute_error(ok['y7'], np.full(len(ok), ok['y7'].median())):.3f}")
    print("=" * 62)

    final = new_model().fit(X, y)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": final, "features": feats, "weight_source": source}, MODEL_PATH)
    print(f"✅ Model saved: {MODEL_PATH}")
    if source == "SIMULATED":
        print("⚠️  Weight SIMULATED hai: upar ke numbers real accuracy nahi hain.")


# ---------------------------------------------------------------------------
# 2) PREDICT : anchor weight + predicted daily changes  ->  current weight
# ---------------------------------------------------------------------------
def estimate_current_weight(raw: pd.DataFrame, anchor_weight_kg: float, anchor_date, until=None) -> dict:
    """
    raw : EK hive ke readings, columns: nectar_id, date, temperature, humidity, audio_feature
          (anchor_date se kuch din PEHLE ka data bhi do, taaki lag/rolling features ban sakein)
    anchor_weight_kg : anchor_date ki subah farmer ne jo weight daali
    """
    bundle = joblib.load(MODEL_PATH)
    anchor_date = pd.Timestamp(anchor_date).normalize()

    d = daily_features(raw)
    d["weight_change_kg"] = bundle["model"].predict(d[bundle["features"]])
    d = d[d["date"] >= anchor_date]
    if until is not None:
        d = d[d["date"] <= pd.Timestamp(until).normalize()]
    if d.empty:
        raise ValueError("anchor date ke baad ka sensor data nahi mila.")
    d = d.copy()

    missing = len(pd.date_range(anchor_date, d["date"].max())) - d["date"].nunique()
    if missing > 0:
        warnings.warn(f"{missing} din ka sensor data missing hai -> weight estimate kam reliable. "
                      "Nayi weight daal kar re-anchor karo.")

    d["change_since_anchor_kg"] = d["weight_change_kg"].cumsum()
    d["weight_est_kg"] = anchor_weight_kg + d["change_since_anchor_kg"]

    k = min(7, len(d))
    summary = {
        "anchor_date": str(anchor_date.date()),
        "anchor_weight_kg": float(anchor_weight_kg),
        "latest_date": str(d["date"].iloc[-1].date()),
        "current_weight_kg": float(d["weight_est_kg"].iloc[-1]),
        "total_change_kg": float(d["change_since_anchor_kg"].iloc[-1]),
        "last_days": int(k),
        "last_days_change_kg": float(d["weight_change_kg"].tail(k).sum()),
        "latest_day_change_kg": float(d["weight_change_kg"].iloc[-1]),
        "weight_source": bundle.get("weight_source", "UNKNOWN"),
    }
    cols = ["date", "weight_change_kg", "change_since_anchor_kg", "weight_est_kg"]
    return {"summary": summary, "daily": d[cols].reset_index(drop=True)}


def show(res: dict):
    s, d = res["summary"], res["daily"].copy()
    d["date"] = d["date"].dt.strftime("%Y-%m-%d")
    fmt = {"weight_change_kg": "{:+.3f}".format,
           "change_since_anchor_kg": "{:+.3f}".format,
           "weight_est_kg": "{:.2f}".format}
    print("\n=== DAILY WEIGHT CHANGE (AI predicted) ===")
    print(d.to_string(index=False, formatters=fmt))
    print("\n=== SUMMARY ===")
    print(f"  Anchor weight ({s['anchor_date']})   : {s['anchor_weight_kg']:.2f} kg")
    print(f"  Aaj ka weight change ({s['latest_date']}): {s['latest_day_change_kg']:+.3f} kg")
    print(f"  Pichhle {s['last_days']} din ka change      : {s['last_days_change_kg']:+.3f} kg")
    print(f"  Anchor ke baad total change     : {s['total_change_kg']:+.3f} kg")
    print(f"  CURRENT WEIGHT ({s['latest_date']})  : {s['current_weight_kg']:.2f} kg")
    if s["weight_source"] == "SIMULATED":
        print("\n⚠️  Model SIMULATED weight par train hua hai: ye number real weight nahi hai.")


def main():
    ap = argparse.ArgumentParser(description="Hive weight predictor")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("train", help="weight-change model train karo")
    p = sub.add_parser("predict", help="anchor weight se current weight nikalo")
    p.add_argument("--hive", type=int, required=True, help="nectar_id (jaise 2001)")
    p.add_argument("--date", required=True, help="anchor date YYYY-MM-DD (jis din weight daali)")
    p.add_argument("--weight", type=float, required=True, help="anchor weight kg")
    p.add_argument("--until", default=None, help="is date tak ka estimate (default: latest data)")
    a = ap.parse_args()

    if a.cmd == "train":
        train()
    else:
        sensors = load_sensors()
        raw = sensors[sensors["nectar_id"] == a.hive]
        if raw.empty:
            raise SystemExit(f"Hive {a.hive} ka sensor data nahi mila.")
        show(estimate_current_weight(raw, a.weight, a.date, a.until))


if __name__ == "__main__":
    main()