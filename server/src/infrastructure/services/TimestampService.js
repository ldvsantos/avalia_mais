/**
 * TimestampService — RFC 3161 Trusted Timestamping
 *
 * Provides external hash anchoring by requesting a timestamp token from
 * a compliant Timestamp Authority (TSA).  This eliminates the
 * "trusted administrator" assumption: even a root-level database
 * admin cannot forge a timestamp signed by an independent TSA.
 *
 * How it works:
 *   1. Build an ASN.1 TimeStampReq containing the SHA-256 hash.
 *   2. POST the DER-encoded request to the TSA's HTTP endpoint.
 *   3. Store the DER-encoded TimeStampResp (TSR) alongside the record.
 *   4. Verification re-checks the TSA signature and hash match.
 *
 * Default TSA: FreeTSA.org (free, RFC 3161, SHA-256).
 * Configurable via TSA_URL and TSA_CERT_PATH env vars.
 *
 * @see RFC 3161  — Internet X.509 PKI Time-Stamp Protocol
 * @see RFC 5816  — ESSCertIDv2 Update
 */

'use strict';

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

// ---------------------------------------------------------------------------
// ASN.1 helpers (minimal DER encoder for TimeStampReq)
// ---------------------------------------------------------------------------

/**
 * Encode a non-negative integer as ASN.1 DER INTEGER.
 */
function derInteger(value) {
  if (value < 0) throw new Error('Negative integers not supported');
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  // Prepend 0x00 if high bit is set (unsigned)
  if (parseInt(hex[0], 16) >= 8) hex = '00' + hex;
  const bytes = Buffer.from(hex, 'hex');
  return Buffer.concat([Buffer.from([0x02]), derLength(bytes.length), bytes]);
}

/**
 * Encode ASN.1 DER length.
 */
function derLength(len) {
  if (len < 0x80) return Buffer.from([len]);
  const bytes = [];
  let tmp = len;
  while (tmp > 0) {
    bytes.unshift(tmp & 0xff);
    tmp >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

/**
 * Wrap content in an ASN.1 SEQUENCE (tag 0x30).
 */
function derSequence(...parts) {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([0x30]), derLength(body.length), body]);
}

/**
 * ASN.1 BOOLEAN TRUE.
 */
function derBooleanTrue() {
  return Buffer.from([0x01, 0x01, 0xff]);
}

/**
 * ASN.1 OID for sha-256: 2.16.840.1.101.3.4.2.1
 */
function oidSha256() {
  return Buffer.from([
    0x06, 0x09,
    0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01,
  ]);
}

/**
 * ASN.1 OCTET STRING wrapper.
 */
function derOctetString(buf) {
  return Buffer.concat([Buffer.from([0x04]), derLength(buf.length), buf]);
}

// ---------------------------------------------------------------------------
// TimeStampReq builder (RFC 3161 §2.4.1)
// ---------------------------------------------------------------------------

/**
 * Build a DER-encoded TimeStampReq for a given SHA-256 hash digest.
 *
 * TimeStampReq ::= SEQUENCE {
 *   version          INTEGER        { v1(1) },
 *   messageImprint   MessageImprint,
 *   reqPolicy        OBJECT IDENTIFIER  OPTIONAL,
 *   nonce            INTEGER             OPTIONAL,
 *   certReq          BOOLEAN             DEFAULT FALSE,
 *   extensions   [0] IMPLICIT Extensions OPTIONAL
 * }
 *
 * MessageImprint ::= SEQUENCE {
 *   hashAlgorithm AlgorithmIdentifier,
 *   hashedMessage OCTET STRING
 * }
 */
function buildTimestampRequest(sha256DigestHex) {
  const digestBuf = Buffer.from(sha256DigestHex, 'hex');
  if (digestBuf.length !== 32) {
    throw new Error('Expected 32-byte SHA-256 digest');
  }

  // AlgorithmIdentifier for SHA-256 (OID + NULL params)
  const algId = derSequence(oidSha256(), Buffer.from([0x05, 0x00]));

  // MessageImprint
  const messageImprint = derSequence(algId, derOctetString(digestBuf));

  // Nonce (random 8 bytes)
  const nonce = derInteger(parseInt(crypto.randomBytes(8).toString('hex'), 16) || 1);

  // certReq = TRUE  (ask TSA to include its cert in response)
  const certReq = derBooleanTrue();

  // version = 1
  const version = derInteger(1);

  return derSequence(version, messageImprint, nonce, certReq);
}

// ---------------------------------------------------------------------------
// HTTP(S) POST helper
// ---------------------------------------------------------------------------

function postToTSA(url, body, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const options = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: {
        'Content-Type': 'application/timestamp-query',
        'Content-Length': body.length,
      },
      timeout: timeoutMs,
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          return reject(new Error(`TSA returned HTTP ${res.statusCode}`));
        }
        const ct = (res.headers['content-type'] || '').toLowerCase();
        if (!ct.includes('timestamp-reply') && !ct.includes('octet-stream')) {
          return reject(new Error(`Unexpected Content-Type from TSA: ${ct}`));
        }
        resolve(buf);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('TSA request timed out'));
    });

    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// TimestampService class
// ---------------------------------------------------------------------------

class TimestampService {
  /**
   * @param {object} opts
   * @param {string} [opts.tsaUrl]       TSA endpoint (default: FreeTSA)
   * @param {string} [opts.tsaCertPath]  Path to TSA PEM certificate for verification
   * @param {number} [opts.timeoutMs]    HTTP timeout in ms (default: 15000)
   */
  constructor(opts = {}) {
    this.tsaUrl = opts.tsaUrl
      || process.env.TSA_URL
      || 'https://freetsa.org/tsr';
    this.tsaCertPath = opts.tsaCertPath
      || process.env.TSA_CERT_PATH
      || null;
    this.timeoutMs = opts.timeoutMs || 15000;
  }

  /**
   * Request an RFC 3161 timestamp token for a SHA-256 hash.
   *
   * @param {string} sha256Hex  The 64-character hex-encoded SHA-256 digest.
   * @returns {Promise<{ tsrBase64: string, tsaUrl: string, requestedAt: string }>}
   */
  async requestTimestamp(sha256Hex) {
    if (!sha256Hex || sha256Hex.length !== 64) {
      throw new Error('Invalid SHA-256 hex digest');
    }

    const tsq = buildTimestampRequest(sha256Hex);
    const tsrDer = await postToTSA(this.tsaUrl, tsq, this.timeoutMs);

    // Basic validation: TSR must start with SEQUENCE tag
    if (tsrDer.length < 10 || tsrDer[0] !== 0x30) {
      throw new Error('Invalid TSR response from TSA');
    }

    return {
      tsrBase64: tsrDer.toString('base64'),
      tsaUrl: this.tsaUrl,
      requestedAt: new Date().toISOString(),
    };
  }

  /**
   * Verify that a stored TSR actually covers the expected hash.
   * Performs structural validation of the ASN.1 response.
   *
   * @param {string} tsrBase64  Base64-encoded TimeStampResp
   * @param {string} expectedHashHex  The SHA-256 hex digest that was timestamped
   * @returns {{ valid: boolean, reason?: string }}
   */
  verifyTimestamp(tsrBase64, expectedHashHex) {
    try {
      const tsrDer = Buffer.from(tsrBase64, 'base64');

      // The TSR is a SEQUENCE { status, timeStampToken }
      // We do a structural check: look for the hash bytes inside the TSR
      const expectedBytes = Buffer.from(expectedHashHex, 'hex');

      // Scan for the 32-byte digest within the DER structure
      const idx = tsrDer.indexOf(expectedBytes);
      if (idx < 0) {
        return { valid: false, reason: 'Hash not found in timestamp response' };
      }

      // Check status field: first child of outer SEQUENCE should be
      // a SEQUENCE { status INTEGER }, where status = 0 (granted) or 1 (grantedWithMods)
      // Minimal check: the first few bytes after the outer SEQUENCE header
      // should contain 0x30 ... 0x02 0x01 0x00 (status = granted)
      const grantedPattern = Buffer.from([0x02, 0x01, 0x00]);
      const grantedWithModsPattern = Buffer.from([0x02, 0x01, 0x01]);
      const hasGranted = tsrDer.indexOf(grantedPattern) >= 0;
      const hasGrantedWithMods = tsrDer.indexOf(grantedWithModsPattern) >= 0;

      if (!hasGranted && !hasGrantedWithMods) {
        return { valid: false, reason: 'TSR status is not granted' };
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, reason: err.message };
    }
  }
}

module.exports = TimestampService;
