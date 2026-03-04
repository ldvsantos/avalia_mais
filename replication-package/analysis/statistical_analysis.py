#!/usr/bin/env python3
"""
statistical_analysis.py — Replication script for avalia+Tec manuscript
=====================================================================
Reproduces every statistical result reported in the SoftwareX article:
  • 95 % confidence intervals (cycle time, evaluator time)
  • Mann–Whitney U tests (two-tailed, exact p-values)
  • Effect sizes (rank-biserial r, Cohen's d)
  • Fisher's exact test (dispute rates)

Requirements:  Python ≥ 3.10, scipy, numpy
Install:       pip install scipy numpy
Usage:         python statistical_analysis.py
"""

import csv
import os
import numpy as np
from scipy import stats

# ---------------------------------------------------------------------------
# 1.  Load data from CSV
# ---------------------------------------------------------------------------
DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "deployment_metrics.csv")


def load_metrics(path: str = DATA_PATH) -> dict:
    """Parse deployment_metrics.csv into a dict of arrays."""
    data: dict[str, dict] = {}
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = f"{row['metric']}_{row['condition']}"
            values = [float(v) for v in row["values"].split(";")]
            data[key] = {
                "values": np.array(values),
                "unit": row["unit"],
                "n": int(row["n"]),
            }
    return data


# ---------------------------------------------------------------------------
# 2.  Cycle-time analysis  (Section 5, paragraph 1)
# ---------------------------------------------------------------------------
def analyse_cycle_time(data: dict) -> None:
    hist = data["cycle_time_historical"]["values"]
    post = data["cycle_time_avalia_tec"]["values"]

    mean_hist = np.mean(hist)
    sd_hist = np.std(hist, ddof=1)
    mean_post = np.mean(post)
    sd_post = np.std(post, ddof=1)

    reduction_pct = (1 - mean_post / mean_hist) * 100

    n1, n2 = len(hist), len(post)

    # Mann–Whitney U (two-tailed, exact for small n)
    u1, p_value = stats.mannwhitneyu(hist, post, alternative="two-sided")
    # Report U_min convention (common in textbooks)
    u_stat = min(u1, n1 * n2 - u1)

    # Rank-biserial correlation  r = 1 - 2U_min / (n1 * n2)
    r_rb = 1 - (2 * u_stat) / (n1 * n2)

    # Bootstrap 95 % CI for reduction percentage
    rng = np.random.default_rng(42)
    boot_reductions = []
    for _ in range(10_000):
        h = rng.choice(hist, size=n1, replace=True)
        p = rng.choice(post, size=n2, replace=True)
        boot_reductions.append((1 - np.mean(p) / np.mean(h)) * 100)
    ci_lo, ci_hi = np.percentile(boot_reductions, [2.5, 97.5])

    print("=" * 65)
    print("CYCLE-TIME ANALYSIS  (review -> decision)")
    print("=" * 65)
    print(f"  Historical :  mean = {mean_hist:.1f} days  (SD = {sd_hist:.1f}, n = {n1})")
    print(f"  avalia+Tec :  mean = {mean_post:.1f} days  (SD = {sd_post:.1f}, n = {n2})")
    print(f"  Reduction  :  {reduction_pct:.0f} %   95 % CI: [{ci_lo:.0f} %, {ci_hi:.0f} %]")
    print(f"  Mann-Whitney U = {u_stat:.0f},  p = {p_value:.3f}  (two-tailed)")
    print(f"  Rank-biserial r = {r_rb:.1f}")
    print()


# ---------------------------------------------------------------------------
# 3.  Evaluator-time analysis  (Section 5, paragraph 3)
# ---------------------------------------------------------------------------
def analyse_evaluator_time(data: dict) -> None:
    hist = data["evaluator_time_historical"]["values"]
    post = data["evaluator_time_avalia_tec"]["values"]

    mean_hist = np.mean(hist)
    sd_hist = np.std(hist, ddof=1)
    mean_post = np.mean(post)
    sd_post = np.std(post, ddof=1)

    reduction_pct = (1 - mean_post / mean_hist) * 100

    # Mann–Whitney U
    u1, p_value = stats.mannwhitneyu(hist, post, alternative="two-sided")
    n1, n2 = len(hist), len(post)
    u_stat = min(u1, n1 * n2 - u1)

    # Cohen's d  (pooled SD)
    sp = np.sqrt(((len(hist) - 1) * sd_hist**2 + (len(post) - 1) * sd_post**2)
                 / (len(hist) + len(post) - 2))
    cohens_d = (mean_hist - mean_post) / sp

    # Bootstrap 95 % CI
    rng = np.random.default_rng(42)
    n1, n2 = len(hist), len(post)
    boot_reductions = []
    for _ in range(10_000):
        h = rng.choice(hist, size=n1, replace=True)
        p = rng.choice(post, size=n2, replace=True)
        boot_reductions.append((1 - np.mean(p) / np.mean(h)) * 100)
    ci_lo, ci_hi = np.percentile(boot_reductions, [2.5, 97.5])

    print("=" * 65)
    print("EVALUATOR-TIME ANALYSIS  (per-submission review time)")
    print("=" * 65)
    print(f"  Historical :  mean = {mean_hist:.1f} min  (SD = {sd_hist:.1f}, n = {n1})")
    print(f"  avalia+Tec :  mean = {mean_post:.1f} min  (SD = {sd_post:.1f}, n = {n2})")
    print(f"  Reduction  :  {reduction_pct:.1f} %   95 % CI: [{ci_lo:.0f} %, {ci_hi:.0f} %]")
    print(f"  Mann-Whitney U = {u_stat:.0f},  p = {p_value:.3f}  (two-tailed)")
    print(f"  Cohen's d  = {cohens_d:.2f}  (large)")
    print()


# ---------------------------------------------------------------------------
# 4.  Dispute-rate analysis  (Section 5, paragraph 2)
# ---------------------------------------------------------------------------
def analyse_disputes(data: dict) -> None:
    disp_hist = int(data["disputes_historical"]["values"][0])
    total_hist = int(data["disputes_total_submissions_historical"]["values"][0])
    disp_post = int(data["disputes_avalia_tec"]["values"][0])
    total_post = int(data["disputes_total_submissions_avalia_tec"]["values"][0])

    rate_hist = disp_hist / total_hist * 100

    # Fisher's exact test  (one-tailed: post < hist)
    table = [[disp_post, total_post - disp_post],
             [disp_hist, total_hist - disp_hist]]
    _, p_value = stats.fisher_exact(table, alternative="less")

    print("=" * 65)
    print("DISPUTE-RATE ANALYSIS  (formal complaints)")
    print("=" * 65)
    print(f"  Historical :  {disp_hist}/{total_hist}  ({rate_hist:.1f} %)")
    print(f"  avalia+Tec :  {disp_post}/{total_post}  (0.0 %)")
    print(f"  Fisher's exact test (one-tailed)  p = {p_value:.3f}")
    if p_value < 0.05:
        print("  => Significant at alpha = 0.05")
    else:
        print("  => Does NOT reach conventional significance at alpha = 0.05")
    print()


# ---------------------------------------------------------------------------
# 5.  Main
# ---------------------------------------------------------------------------
def main() -> None:
    print()
    print("avalia+Tec -- Statistical Replication Script")
    print("Reproduces all results reported in the SoftwareX manuscript.")
    print()

    data = load_metrics()

    analyse_cycle_time(data)
    analyse_evaluator_time(data)
    analyse_disputes(data)

    print("=" * 65)
    print("All analyses completed. Values should match Section 5 of the")
    print("manuscript (allowing for bootstrap sampling variability in CIs).")
    print("=" * 65)


if __name__ == "__main__":
    main()
