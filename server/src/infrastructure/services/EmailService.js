const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined,
        },
      });

      // Validação rápida (não bloqueante) da conexão/credenciais
      this.transporter.verify()
        .then(() => {
          console.log('EmailService: SMTP transporter verificado com sucesso.');
        })
        .catch((err) => {
          console.error('EmailService: Falha ao verificar SMTP (verify):', err && err.message ? err.message : err);
        });
    } else {
      console.log('EmailService: SMTP configuration missing. Emails will be logged to console.');
    }
  }

  async sendEmail(to, subject, text, html, attachments = []) {
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: process.env.SMTP_FROM || '"Avalia Mais" <noreply@avalia.com>',
          to,
          subject,
          text,
          html,
          attachments,
        });
        console.log('Email sent: %s', info.messageId);
        return true;
      } catch (error) {
        const code = error && error.code ? String(error.code) : '';
        const responseCode = error && error.responseCode ? String(error.responseCode) : '';
        const msg = error && error.message ? error.message : String(error);
        console.error(`Error sending email${code ? ` [${code}]` : ''}${responseCode ? ` (HTTP ${responseCode})` : ''}: ${msg}`);
        return false;
      }
    } else {
      console.log('--- MOCK EMAIL ---');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Text: ${text}`);
      console.log('------------------');
      return true;
    }
  }
}

module.exports = EmailService;
