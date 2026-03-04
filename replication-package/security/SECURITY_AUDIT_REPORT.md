# Security Audit Report — avalia+Tec

**Date:** 2026-03-04  
**Auditor:** Automated (npm audit + manual review)  
**Node.js:** v22.20.0  
**npm:** 10.9.3  
**Package:** avalia-server@1.0.0  
**Total dependencies audited:** 327 (production)

---

## 1. npm audit — Dependency Vulnerability Scan

### Final Result: ✅ 0 vulnerabilities

```
found 0 vulnerabilities
```

```json
{
  "auditReportVersion": 2,
  "vulnerabilities": {},
  "metadata": {
    "vulnerabilities": {
      "info": 0,
      "low": 0,
      "moderate": 0,
      "high": 0,
      "critical": 0,
      "total": 0
    },
    "dependencies": {
      "prod": 327,
      "dev": 0,
      "optional": 1,
      "peer": 0,
      "peerOptional": 0,
      "total": 327
    }
  }
}
```

### Vulnerabilities Fixed (2026-03-04)

| Package | Severity | Advisory | Fix Applied |
|---------|----------|----------|-------------|
| lodash 4.0.0–4.17.21 | Moderate | GHSA-xxjr-mmjv-4gpg (Prototype Pollution in `_.unset`/`_.omit`) | Updated via `npm audit fix` |
| minimatch ≤3.1.3 | High | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 (ReDoS) | Updated via `npm audit fix` |
| multer ≤2.0.2 | High | GHSA-xf7r-hgr6-v32p, GHSA-v52c-386h-88mc (DoS via resource exhaustion) | Updated to 2.1.1 |
| qs ≤6.14.1 | Moderate | GHSA-w7fw-mjwx-w883, GHSA-6rw7-vpxm-498p (DoS via memory exhaustion) | Updated via `npm audit fix` |

All 4 vulnerabilities were resolved via `npm audit fix` with no breaking changes.

---

## 2. Production Dependencies (depth=0)

| Package | Version | Purpose |
|---------|---------|---------|
| cookie-parser | 1.4.7 | Cookie parsing middleware |
| cors | 2.8.5 | Cross-Origin Resource Sharing |
| dotenv | 17.2.3 | Environment variable management |
| exceljs | 4.4.0 | Excel spreadsheet generation |
| express | 4.22.1 | Web framework |
| express-rate-limit | 7.5.1 | API rate limiting (DoS protection) |
| express-session | 1.18.2 | Session management |
| express-validator | 7.3.1 | Input validation & sanitization |
| geoip-lite | 1.4.10 | IP geolocation (analytics) |
| helmet | 7.2.0 | Security headers (OWASP) |
| jsonwebtoken | 9.0.3 | JWT authentication |
| multer | 2.1.1 | File upload handling |
| node-forge | 1.3.3 | Cryptographic operations |
| node-signpdf | 3.0.0 | PDF digital signing |
| nodemailer | 7.0.11 | Email notifications |
| pdf-lib | 1.17.1 | PDF manipulation |
| pdf-parse | 1.1.4 | PDF text extraction |
| pdfkit | 0.17.2 | PDF generation |
| pg | 8.16.3 | PostgreSQL client |
| qrcode | 1.5.4 | QR code generation |
| sanitize-html | 2.17.0 | HTML sanitization (XSS prevention) |
| speakeasy | 2.0.0 | TOTP/2FA |
| winston | 3.19.0 | Logging framework |

---

## 3. Security Controls Implemented in Code

### 3.1 HTTP Security Headers (helmet.js)

| Header | Value | OWASP Ref |
|--------|-------|-----------|
| X-Content-Type-Options | nosniff | A05 |
| X-Frame-Options | DENY | A05 |
| X-XSS-Protection | 1; mode=block | A03 |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | A05 |
| Referrer-Policy | strict-origin-when-cross-origin | A05 |
| Content-Security-Policy | Configured | A05 |

**Source:** `server/index.js` (helmet middleware)

### 3.2 Rate Limiting (express-rate-limit)

| Parameter | Value |
|-----------|-------|
| Window | 15 minutes |
| Max requests per window | Configurable per route |
| Response on limit | HTTP 429 Too Many Requests |

**Source:** `server/index.js` (express-rate-limit middleware)

### 3.3 Input Validation & Sanitization

- **express-validator:** Schema-based validation on all POST/PUT routes
- **sanitize-html:** HTML tag stripping on user-generated content
- **Parameterized queries:** All PostgreSQL queries use `$1, $2...` placeholders (no string concatenation)

### 3.4 Authentication & Authorization

- **JWT tokens:** Signed with HS256, configurable expiration
- **RBAC:** Role-based access control (admin, evaluator, candidate)
- **PostgreSQL RLS:** Row-level security policies enforcing data isolation
- **TOTP/2FA:** Available via speakeasy for admin accounts

### 3.5 Cryptographic Integrity

- **SHA-256 hash chains:** Tamper-evident audit trail for all submissions
- **HMAC-SHA256:** API authentication tokens
- **RFC 3161 timestamping:** External hash anchoring (TimestampService.js)
- **PDF digital signatures:** node-signpdf for certificate authenticity

### 3.6 Security Logging

- **Winston logger:** Structured security events with taxonomy
- **Event types:** `RATE_LIMIT_EXCEEDED`, `AUTH_FAILURE`, `SUSPICIOUS_INPUT`, `CHAIN_VALIDATION_FAILURE`
- **Source:** `server/security-logger.js`

---

## 4. OWASP Top 10 (2021) Coverage

| Category | Status | Mechanism |
|----------|--------|-----------|
| A01 — Broken Access Control | ✅ Mitigated | RBAC + JWT + PostgreSQL RLS |
| A02 — Cryptographic Failures | ✅ Mitigated | SHA-256, HMAC, TLS (nginx) |
| A03 — Injection | ✅ Mitigated | Parameterized queries, express-validator, sanitize-html |
| A04 — Insecure Design | ⚠️ Partial | Threat model documented; no formal DPIA |
| A05 — Security Misconfiguration | ✅ Mitigated | helmet.js defaults, .env for secrets |
| A06 — Vulnerable Components | ✅ Mitigated | npm audit: 0 vulnerabilities (this report) |
| A07 — Auth Failures | ✅ Mitigated | JWT + rate limiting on auth routes |
| A08 — Software Integrity | ✅ Mitigated | SHA-256 hash chains, RFC 3161 anchoring |
| A09 — Logging/Monitoring | ✅ Mitigated | Winston security logger with event taxonomy |
| A10 — SSRF | ⚠️ Partial | No outbound request proxy; URL validation on user inputs |

---

## 5. Known Limitations

1. **No formal penetration testing** has been conducted by an external party.
2. **No OWASP ZAP automated scan** has been performed (recommended for future work).
3. **DPIA (Data Protection Impact Assessment)** has not been formally conducted; declared as institutional responsibility.
4. **Secret rotation** is documented but not automated.
5. **Single-node architecture** means a privileged admin can rewrite the hash chain (mitigated by RFC 3161 external anchoring).

---

## 6. Recommendations for Future Work

1. Conduct formal penetration testing with OWASP ZAP or Burp Suite.
2. Implement automated dependency scanning via GitHub Dependabot or Snyk.
3. Conduct DPIA in partnership with the deploying institution's DPO.
4. Implement automated secret rotation.
5. Consider adding CSP reporting endpoint for Content-Security-Policy violations.

---

*Report generated on 2026-03-04. This report should be regenerated after any dependency update or significant code change.*
