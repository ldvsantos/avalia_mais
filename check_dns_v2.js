const dns = require('dns');
const fs = require('fs');

dns.resolve4('avaliamais.tec.br', (err, addresses) => {
    let output = '';
    if (err) {
        output = `Error: ${err.message}`;
    } else {
        output = `IPs: ${JSON.stringify(addresses)}`;
    }
    fs.writeFileSync('dns_result.txt', output);
    console.log(output);
});