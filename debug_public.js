const fs = require('fs');
const http = require('http');

const outFile = '/opt/avalia/src/status_debug.txt';
const log = (msg) => {
    try {
        fs.appendFileSync(outFile, msg + '\n');
    } catch (e) {
        console.error('Cannot write log:', e);
    }
    console.log(msg);
};

try {
    fs.writeFileSync(outFile, '--- START DEBUG ---\n');
    
    // Check file
    const target = '/opt/avalia/src/apresentacao/index.html';
    log(`Checking file ${target}: ${fs.existsSync(target)}`);
    
    if (fs.existsSync(target)) {
        try {
            const stats = fs.statSync(target);
            log(`Permissions: ${stats.mode} UID: ${stats.uid}`);
        } catch(e) { log('Error reading stats: ' + e.message); }
    } else {
        log('File check failed.');
        try {
            log('Parent dir content: ' + fs.readdirSync('/opt/avalia/src').join(', '));
            log('Apresentacao content: ' + fs.readdirSync('/opt/avalia/src/apresentacao').join(', '));
        } catch(e) { log('Cannot read dirs: ' + e.message); }
    }

    // Check HTTP
    http.get('http://localhost:3000/apresentacao/index.html', (res) => {
        log(`HTTP Localhost Status: ${res.statusCode}`);
    }).on('error', (e) => {
        log(`HTTP Error: ${e.message}`);
    });

} catch(e) {
    console.error(e);
}