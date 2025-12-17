require('dotenv').config();
const EmailService = require('./src/infrastructure/services/EmailService');

async function test() {
  console.log('Testing EmailService...');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_USER:', process.env.SMTP_USER);

  const emailService = new EmailService();
  const to = process.env.SMTP_USER; // Send to self for testing
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
