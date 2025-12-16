const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ADMIN_SECRET_FILE = path.join(__dirname, '.admin-secret');

/**
 * Gera ou lê o UUID secreto para as rotas administrativas
 * Este UUID é criado apenas uma vez e deve ser guardado com segurança
 */
function generateOrReadAdminSecret() {
  if (fs.existsSync(ADMIN_SECRET_FILE)) {
    const secret = fs.readFileSync(ADMIN_SECRET_FILE, 'utf8').trim();
    console.log(`✓ Admin secret carregado: /secret/${secret}/`);
    return secret;
  }
  
  const secret = crypto.randomUUID();
  
  // Salvar com permissões restritas (apenas leitura do proprietário em Unix)
  try {
    fs.writeFileSync(ADMIN_SECRET_FILE, secret, { mode: 0o600 });
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  ADMIN SECRET CRIADO - SALVE EM LOCAL SEGURO');
    console.log('='.repeat(70));
    console.log(`\nUUID Administrativo (salve em cofre seguro):\n`);
    console.log(`   ${secret}\n`);
    console.log(`URL de acesso:\n`);
    console.log(`   http://localhost:3000/secret/${secret}/admin\n`);
    console.log('Este UUID NÃO será mostrado novamente!');
    console.log('Arquivo: server/.admin-secret (NUNCA commitar no Git)\n');
    console.log('='.repeat(70) + '\n');
  } catch (err) {
    console.error('Erro ao salvar admin secret:', err);
  }
  
  return secret;
}

/**
 * Valida se um UUID é válido (formato UUID v4)
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

module.exports = {
  generateOrReadAdminSecret,
  isValidUUID
};
