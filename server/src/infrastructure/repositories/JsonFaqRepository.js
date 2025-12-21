const fs = require('fs');
const path = require('path');
const { safeWriteFileUtf8Atomic } = require('./fileUtils');

class JsonFaqRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'faq_v4.json');
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
    // Seed inicial atualizado com foco na Operacionalização do Site e Edital
    return {
      updatedAt: new Date().toISOString(),
      sections: [
        {
          id: 'inscricao_site',
          title: 'Como realizar a Inscrição no Site',
          items: [
            {
              question: 'Como preencher o formulário de inscrição?',
              answer: 'Acesse a página "Inscrição" neste portal. Preencha seus dados pessoais e, na seção "Projeto de Pesquisa", digite ou cole os textos do seu Anteprojeto (Resumo, Introdução, etc.) nos campos correspondentes. O sistema formatará tudo automaticamente.'
            },
            {
              question: 'O site salva rascunho?',
              answer: 'NÃO. O site não salva rascunhos. Recomendamos que você escreva seu Anteprojeto em um editor de texto (Word, Docs) e, quando estiver pronto, copie e cole nos campos do site para evitar perda de dados.'
            },
            {
              question: 'Como gero o PDF da inscrição?',
              answer: 'Ao final do preenchimento, clique no botão "Enviar Inscrição e Gerar PDF". O sistema registrará seus dados e baixará automaticamente um arquivo PDF contendo sua Ficha de Inscrição e o Anteprojeto.'
            },
            {
              question: 'O que faço com o PDF gerado?',
              answer: 'Este PDF é o seu comprovante e contém os Anexos I e IV preenchidos. Você deve enviá-lo para o e-mail da seleção (seletivoplanterr@gmail.com) juntamente com os demais documentos exigidos (RG, Diploma, etc.), conforme o item 4 do Edital.'
            }
          ]
        },
        {
          id: 'anteprojeto',
          title: 'Preenchimento do Anteprojeto',
          items: [
            {
              question: 'Posso colocar meu nome no Anteprojeto?',
              answer: 'NÃO. O Anteprojeto (campos de texto do projeto) NÃO deve conter seu nome ou qualquer identificação, pois a avaliação é "às cegas". Se houver identificação no corpo do texto, sua inscrição poderá ser indeferida.'
            },
            {
              question: 'Como respeito o limite de caracteres?',
              answer: 'Cada campo de texto possui um contador de caracteres abaixo dele. O sistema não permitirá digitar além do limite. Planeje seu texto para caber nos espaços estipulados.'
            }
          ]
        },
        {
          id: 'recurso_site',
          title: 'Como interpor Recurso',
          items: [
            {
              question: 'Como faço um recurso pelo site?',
              answer: 'Acesse a página "Recurso", preencha o formulário com seu protocolo de inscrição e a argumentação. Ao clicar em "Enviar Recurso", o sistema registrará seu pedido.'
            },
            {
              question: 'Preciso enviar o recurso por e-mail também?',
              answer: 'Sim. O Edital prevê o envio por e-mail. Utilize o PDF ou comprovante gerado pelo site (se houver) ou o formulário Anexo XV preenchido e envie para seletivoplanterr@gmail.com dentro do prazo recursal.'
            }
          ]
        },
        {
          id: 'edital_geral',
          title: 'Dúvidas Gerais do Edital',
          items: [
            {
              question: 'Quais documentos são obrigatórios no e-mail?',
              answer: 'Além do PDF gerado no site (Ficha + Anteprojeto), você deve anexar: RG, CPF, Diploma (ou certificado), Histórico Escolar, Currículo Lattes e os demais anexos específicos para cotas ou vínculo empregatício. Consulte o item 4 do Edital.'
            },
            {
              question: 'Qual o prazo de inscrição?',
              answer: 'De 17/10/2025 a 17/11/2025. Não deixe para a última hora para evitar lentidão no sistema ou problemas no envio do e-mail.'
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
