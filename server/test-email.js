const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();
const EmailService = require('./src/infrastructure/services/EmailService');

async function test() {
  console.log('Testing EmailService...');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_SECURE:', process.env.SMTP_SECURE);
  console.log('SMTP_FROM:', process.env.SMTP_FROM);

  const emailService = new EmailService();
  const to = process.env.TEST_EMAIL_TO || process.env.SMTP_USER; // Send to self by default
  if (!to) {
    console.error('Defina TEST_EMAIL_TO ou SMTP_USER para enviar o email de teste.');
    process.exit(1);
  }
  const subject = 'Teste de Envio de Email - AVALIA+';
  const text = 'Este é um email de teste para verificar a configuração do servidor.';

  console.log(`Sending email to ${to}...`);
  const success = await emailService.sendEmail(to, subject, text);

  if (success) {
    console.log('Email sent successfully!');
  } else {
    console.error('Failed to send email.');
  }
}

test();
