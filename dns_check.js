const dns = require('dns');
dns.lookup('avaliamais.tec.br', (err, address) => {
  if (err) console.error(err);
  console.log('IP REAL DO SITE:', address);
});