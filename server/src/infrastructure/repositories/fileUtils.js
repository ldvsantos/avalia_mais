const fs = require('fs');
const path = require('path');

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // busy wait (sync context)
  }
}

function isRetryableFsError(err) {
  const code = err && err.code;
  return code === 'EPERM' || code === 'EBUSY' || code === 'EACCES' || code === 'UNKNOWN';
}

function safeWriteFileUtf8Atomic(filePath, content, { retries = 8, delayMs = 75 } = {}) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const base = path.basename(filePath);
  const stamp = `${process.pid}.${Date.now()}`;
  const tmpPath = path.join(dir, `.${base}.${stamp}.tmp`);
  const bakPath = path.join(dir, `.${base}.${stamp}.bak`);

  let attempt = 0;
  while (true) {
    try {
      fs.writeFileSync(tmpPath, content, 'utf8');

      const hasOld = fs.existsSync(filePath);
      if (hasOld) {
        // Rename original to backup (Windows-safe replace pattern)
        fs.renameSync(filePath, bakPath);
      }

      fs.renameSync(tmpPath, filePath);

      if (hasOld && fs.existsSync(bakPath)) {
        fs.unlinkSync(bakPath);
      }

      return;
    } catch (err) {
      // best-effort cleanup
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch {}

      // restore backup if we moved it but failed to put new file in place
      try {
        if (!fs.existsSync(filePath) && fs.existsSync(bakPath)) {
          fs.renameSync(bakPath, filePath);
        }
      } catch {}

      attempt += 1;
      if (attempt > retries || !isRetryableFsError(err)) {
        throw err;
      }
      sleepSync(delayMs);
    }
  }
}

module.exports = {
  safeWriteFileUtf8Atomic,
};
