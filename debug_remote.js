const fs = require('fs');
const path = require('path');

const targetPath = '/opt/avalia/src/apresentacao';
console.log('Checking path:', targetPath);

try {
    if (fs.existsSync(targetPath)) {
        console.log('Directory exists!');
        const files = fs.readdirSync(targetPath);
        console.log('Files:', files);
    } else {
        console.log('Directory DOES NOT exist.');
        
        // Check parent
        const parent = '/opt/avalia/src';
        console.log('Checking parent:', parent);
        if (fs.existsSync(parent)) {
             console.log('Parent files:', fs.readdirSync(parent));
        } else {
            console.log('Parent DOES NOT exist.');
             // Check root
             if (fs.existsSync('/opt/avalia')) {
                console.log('Checking /opt/avalia:', fs.readdirSync('/opt/avalia'));
             } else {
                 console.log('/opt/avalia not found');
             }
        }
    }
} catch (e) {
    console.error('Error:', e);
}