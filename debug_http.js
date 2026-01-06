const http = require('http');
const fs = require('fs');

console.log('--- REMOTE DIAGNOSTIC ---');

// 1. Check Files
const targetPath = '/opt/avalia/src/apresentacao/index.html';
try {
    console.log('File check:', targetPath, fs.existsSync(targetPath));
    if(fs.existsSync(targetPath)) {
        const stats = fs.statSync(targetPath);
        console.log('File perms:', stats.mode, 'UID:', stats.uid, 'GID:', stats.gid);
    }
} catch (e) {
    console.log('FS Error:', e.message);
}

// 2. Check HTTP Local
console.log('Testing HTTP request to localhost:3000...');
const req = http.get('http://localhost:3000/apresentacao/index.html', (res) => {
  console.log('HTTP Local check Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers));
  res.on('data', (chunk) => { console.log('Body chunk len:', chunk.length); }); 
});

req.on('error', (e) => {
  console.error('HTTP Local Error:', e.message);
});
req.end();
