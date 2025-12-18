const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

class CertManager {
  constructor(certPath) {
    this.certPath = certPath || path.join(__dirname, '../../../../certs/certificate.p12');
    this.ensureCert();
  }

  ensureCert() {
    const certDir = path.dirname(this.certPath);
    if (!fs.existsSync(certDir)) {
      fs.mkdirSync(certDir, { recursive: true });
    }

    if (!fs.existsSync(this.certPath)) {
      console.log('Generating self-signed certificate for PDF signing...');
      this.generateSelfSignedCert();
    }
  }

  generateSelfSignedCert() {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5); // 5 years

    const attrs = [
      { name: 'commonName', value: 'Planterr System' },
      { name: 'countryName', value: 'BR' },
      { shortName: 'ST', value: 'Bahia' },
      { name: 'localityName', value: 'Feira de Santana' },
      { name: 'organizationName', value: 'Planterr' },
      { shortName: 'OU', value: 'IT' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(keys.privateKey);

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      keys.privateKey,
      [cert],
      'planterr_secret' // Password for the p12
    );

    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    fs.writeFileSync(this.certPath, p12Der, 'binary');
    console.log('Certificate generated at:', this.certPath);
  }

  getCertBuffer() {
    return fs.readFileSync(this.certPath);
  }
}

module.exports = new CertManager();
