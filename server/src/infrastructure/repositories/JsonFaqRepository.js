const fs = require('fs');
const path = require('path');
const { safeWriteFileUtf8Atomic } = require('./fileUtils');

class JsonFaqRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'faq.json');
    this.ensureFile();
  }

  ensureFile() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      const seed = this.getDefault();
      safeWriteFileUtf8Atomic(this.filePath, JSON.stringify(seed, null, 2) + '\n');
    }
  }

  getDefault() {
    // Seed inicial baseado no conteúdo que existia em src/suporte.html
    return {
      updatedAt: new Date().toISOString(),
      sections: [
        {
          id: 'problems',
          title: 'Problemas comuns',
          items: [
            {
              question: 'Não recebi o e-mail de confirmação',
              answer: 'Verifique Spam/Lixo e a aba “Promoções”. Se você digitou o e-mail incorretamente, o sistema não consegue reenviar para outro endereço. Nesse caso, contate a comissão conforme Edital.'
            },
            {
              question: 'Perdi meu protocolo',
              answer: 'O protocolo fica no PDF gerado ao final da inscrição. Procure no download do navegador ou no histórico de arquivos do computador. Se não encontrar, contate a comissão conforme Edital.'
            },
            {
              question: '“Enviei e voltou para revisar”',
              answer: 'Isso ocorre quando algum campo obrigatório está incompleto/inválido. O formulário destaca o campo e leva o foco para o primeiro erro.'
            },
            {
              question: 'Não consigo consultar minha inscrição',
              answer: 'Use o protocolo exatamente como aparece no PDF. Se ainda assim falhar, tente novamente em outro navegador.'
            },
            {
              question: 'O botão de enviar está desativado',
              answer: 'As inscrições podem estar fora do prazo. Confira o calendário/cronograma no portal e no Edital.'
            },
            {
              question: 'Erro ao enviar recurso',
              answer: 'Confirme se o protocolo de inscrição está correto e se a etapa do recurso está em prazo. O sistema pode bloquear etapas fora do prazo.'
            }
          ]
        },
        {
          id: 'faq',
          title: 'Perguntas frequentes (FAQ)',
          items: [
            {
              question: 'Como sei que minha inscrição foi registrada?',
              answer: 'Ao concluir, o sistema mostra um protocolo e um hash (SHA-256), além de gerar um PDF com esses dados.'
            },
            {
              question: 'O que é o hash?',
              answer: 'É um código de verificação calculado a partir do registro da inscrição. Ele serve para dar integridade ao comprovante (não é senha).'
            },
            {
              question: 'Posso editar a inscrição depois de enviar?',
              answer: 'Em geral, não. Por isso existe a etapa de revisão antes do envio. Para exceções, siga o que o Edital permitir.'
            },
            {
              question: 'O que devo anexar?',
              answer: 'As exigências variam por perfil (vaga reservada, vínculo empregatício etc.). O formulário sinaliza os anexos condicionais, mas a regra final é a do Edital.'
            }
          ]
        }
      ]
    };
  }

  get() {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.ensureFile();
      }
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return this.getDefault();
      if (!Array.isArray(parsed.sections)) parsed.sections = [];
      if (!parsed.updatedAt) parsed.updatedAt = null;
      return parsed;
    } catch (err) {
      console.error('Error reading faq:', err);
      return this.getDefault();
    }
  }

  save(faq) {
    safeWriteFileUtf8Atomic(this.filePath, JSON.stringify(faq, null, 2) + '\n');
    return faq;
  }
}

module.exports = JsonFaqRepository;
