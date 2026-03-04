# avalia+Tec — Replication Package

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18868994.svg)](https://doi.org/10.5281/zenodo.18868994)

Replication package for the manuscript:

> **avalia+Tec: A Tamper-Evident Platform for Integrity-Verified Academic Selection Processes**
> L.D.V. Santos, C.V.S. Oliveira, D.P.V. Santos, T.C. Azevedo, R.N. Araújo Filho, J.M. Santos, M.M. Fernandes — *SoftwareX* (submitted 2026)

## Contents

```
replication-package/
├── README.md                                ← this file
├── data/
│   └── deployment_metrics.csv               ← anonymized deployment metrics (no PII)
├── analysis/
│   ├── statistical_analysis.py              ← reproduces all CIs, tests, effect sizes
│   └── output_statistical_analysis.txt      ← captured output from running the script
├── load-test/
│   ├── load-test.js                         ← HTTP benchmarking script (autocannon)
│   └── load_test_results.json               ← raw results from executed benchmarks
└── security/
    ├── SECURITY_AUDIT_REPORT.md             ← full security audit report (npm audit + OWASP)
    └── npm_audit_result.json                ← raw npm audit output (0 vulnerabilities)
```

## 1. Anonymized Deployment Metrics (`data/deployment_metrics.csv`)

Contains aggregated, anonymized measurements from the UEFS deployment:

- **cycle_time**: review-decision cycle time in calendar days (4 historical campaigns + 4 avalia+Tec sessions)
- **evaluator_time**: per-submission evaluation time in minutes (6 evaluators, pre vs. post)
- **disputes**: formal complaint counts (historical 3-year total vs. observation period)

**No personally identifiable information (PII) is included.**
All individual submission records, evaluator names, CPF/RG, and candidate data have been excluded.

## 2. Statistical Analysis (`analysis/`)

### Script

`statistical_analysis.py` — Python 3.10+ script that reproduces every statistical result reported in the manuscript:

- 95% bootstrap confidence intervals for cycle-time reduction and evaluator-time reduction (seed = 42, 10,000 resamples)
- Mann–Whitney U tests (two-tailed)
- Effect sizes (rank-biserial r, Cohen's d)
- Fisher's exact test for dispute rates

### Evidence Output

`output_statistical_analysis.txt` — Captured output from running the script on the deployment data. Values match Section 5 (Impact) of the manuscript.

### Requirements

```bash
pip install scipy numpy
```

### Usage

```bash
cd replication-package
python analysis/statistical_analysis.py
```

### Expected Output (key values)

| Metric | Value |
|---|---|
| Cycle-time reduction | 65% (95% CI: [55%, 73%]) |
| Cycle-time Mann–Whitney U | 0 (p = 0.029) |
| Evaluator-time reduction | 45.4% (95% CI: [26%, 59%]) |
| Evaluator-time Mann–Whitney U | 2 (p = 0.009, Cohen's d = 1.88) |
| Fisher's exact test (disputes) | p = 0.069 (not significant) |

## 3. Load Testing (`load-test/`)

### Script

`load-test.js` — HTTP benchmarking script using [autocannon](https://github.com/mcollina/autocannon) for Node.js.

### Results

`load_test_results.json` — Structured JSON results from executed load tests (six scenario/concurrency combinations). Corresponds to Table 5 in the manuscript. Includes requests/sec, latency percentiles (p50, p97.5, p99), throughput, and error counts.

### Requirements (for reproducing)

```bash
npm install autocannon
```

### Step-by-step reproduction

```bash
# 1. Start the avalia+Tec server (JSON storage mode, no PostgreSQL needed)
cd /path/to/avalia_mais
export STORAGE_BACKEND=json
export ENABLE_POSTGRES=0
node server/index.js            # server listens on http://localhost:3000

# 2. In another terminal, run the load test (100 connections, 30 s)
cd replication-package
node load-test/load-test.js http://localhost:3000 30 100

# 3. To replicate the 500-connection scenario
node load-test/load-test.js http://localhost:3000 30 500
```

#### CLI arguments

| Argument | Position | Default | Description |
|---|---|---|---|
| `baseUrl` | 1 | `http://localhost:3000` | Base URL of a running avalia+Tec instance |
| `duration` | 2 | `30` | Test duration in seconds |
| `connections` | 3 | `100` | Number of concurrent connections |

You can also set the `TEST_PROTOCOL` environment variable to specify a valid protocol number for the verification endpoint (default: `PLANTERR-2025-TEST`).

### Scenarios tested

Three scenarios are tested sequentially:

1. `GET /` — landing page (static)
2. `GET /api/verify/:protocol` — integrity verification (DB read + hash check)
3. `POST /api/submissions` — submission creation (SHA-256 hashing + DB write + async RFC 3161)

Results include: requests/sec, latency p50/p97.5/p99, throughput, and error count. A JSON summary is printed at the end; it can be redirected to a file for archival (e.g., `node load-test/load-test.js > my_results.json`).

## 4. Security Audit (`security/`)

### Report

`SECURITY_AUDIT_REPORT.md` — Comprehensive security audit covering:

- **npm audit**: Dependency vulnerability scan (0 vulnerabilities as of 2026-03-04)
- **Production dependencies**: 23 packages with version and purpose
- **Security controls**: helmet.js headers, rate limiting, input validation, RBAC, JWT, PostgreSQL RLS, SHA-256 hash chains, RFC 3161 timestamping
- **OWASP Top 10 (2021) mapping**: Coverage status for all 10 categories
- **Known limitations**: No formal pentest, no OWASP ZAP scan, DPIA not conducted

### Raw Data

`npm_audit_result.json` — Machine-readable npm audit output showing 0 vulnerabilities across 327 production dependencies. Also documents the 4 vulnerabilities that were fixed on 2026-03-04 (lodash, minimatch, multer, qs).

## Environment

- **Statistical analysis**: Python 3.13.7, scipy 1.15.x, numpy 2.2.x
- **Load testing**: Node.js, autocannon (npm), avalia+Tec server in JSON storage mode
- **Production server**: AWS EC2 (Ubuntu 22.04 LTS, PostgreSQL 12)

## License

MIT — see [LICENSE.md](../LICENSE.md) in the repository root.

## Citation

See [CITATION.cff](../CITATION.cff) for machine-readable citation metadata.
