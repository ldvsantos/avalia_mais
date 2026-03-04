-- Migration: Add RFC 3161 external timestamp anchoring columns
-- Supports tamper-evident audit trails via independent TSA verification.
-- See: TimestampService.js

BEGIN;

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS tsr_base64 TEXT,
  ADD COLUMN IF NOT EXISTS tsr_tsa_url TEXT,
  ADD COLUMN IF NOT EXISTS tsr_requested_at TIMESTAMPTZ;

COMMENT ON COLUMN submissions.tsr_base64 IS 'Base64-encoded RFC 3161 TimeStampResp (DER) from external TSA';
COMMENT ON COLUMN submissions.tsr_tsa_url IS 'URL of the Timestamp Authority that issued the TSR';
COMMENT ON COLUMN submissions.tsr_requested_at IS 'When the timestamp was requested from the TSA';

COMMIT;
