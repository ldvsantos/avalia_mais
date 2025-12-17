const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      console.log('EmailService: SMTP configuration missing. Emails will be logged to console.');
    }
  }

  async sendEmail(to, subject, text, html) {
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: process.env.SMTP_FROM || '"Sistema AVALIA+" <noreply@avalia.com>',
          to,
          subject,
          text,
          html,
        });
        console.log('Email sent: %s', info.messageId);
        return true;
      } catch (error) {
        console.error('Error sending email:', error);
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
