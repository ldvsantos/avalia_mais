const fs = require('fs');
const path = require('path');
const { safeWriteFileUtf8Atomic } = require('./fileUtils');

class JsonFaqRepository {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'faq_v3.json');
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
    // Seed inicial atualizado com base no Edital 2026
    return {
      updatedAt: new Date().toISOString(),
      sections: [
        {
          id: 'inscricoes',
          title: 'Inscrições e Documentação',
          items: [
            {
              question: 'Como faço minha inscrição?',
              answer: 'As inscrições são realizadas exclusivamente por e-mail (seletivoplanterr@gmail.com) de 17/10/2025 a 17/11/2025. Você deve enviar a documentação digitalizada (PDF ou JPG, máx 5MB por arquivo) conforme a lista do item 4 do Edital.'
            },
            {
              question: 'Quais documentos são obrigatórios?',
              answer: 'Ficha de Inscrição (Anexo I), Documento de Identificação (RG/CNH), Currículo Lattes atualizado, Termo de Compromisso (Anexo II), Declaração do empregador (se vínculo > 20h) e o Anteprojeto de TCC (Anexo IV) SEM identificação. Candidatos a vagas reservadas devem enviar também os anexos específicos (V a XII).'
            },
            {
              question: 'O Anteprojeto deve ser identificado?',
              answer: 'NÃO. O Anteprojeto de TCC (Anexo IV) não deve conter seu nome ou qualquer identificação, para garantir a imparcialidade na avaliação da Primeira Etapa.'
            },
            {
              question: 'Posso enviar fotos dos documentos?',
              answer: 'Sim, desde que estejam legíveis e sem rasuras, em formato JPG ou PDF. O tamanho máximo é de 5MB por arquivo.'
            }
          ]
        },
        {
          id: 'etapas',
          title: 'Etapas da Seleção',
          items: [
            {
              question: 'Quais são as etapas do processo?',
              answer: '1ª Etapa: Enquadramento e Avaliação do Anteprojeto (Eliminatória/Classificatória, peso 4); 2ª Etapa: Entrevista Presencial (Eliminatória/Classificatória, peso 5); 3ª Etapa: Prova de Língua Estrangeira (Classificatória, peso 1).'
            },
            {
              question: 'Qual a nota mínima para aprovação?',
              answer: 'É necessário obter nota mínima de 7,0 (sete) na Avaliação do Anteprojeto e na Entrevista para não ser eliminado. A média final para aprovação também deve ser igual ou superior a 7,0.'
            },
            {
              question: 'Como funciona a Prova de Língua Estrangeira?',
              answer: 'É uma prova presencial de leitura e interpretação (Inglês ou Espanhol). É permitido o uso de dicionário impresso. Não é permitido o uso de eletrônicos. A nota é classificatória.'
            },
            {
              question: 'Onde ocorrem as etapas presenciais?',
              answer: 'As entrevistas e a prova de língua estrangeira ocorrem no campus da UEFS, em Feira de Santana. Os locais e horários específicos serão divulgados no site do programa.'
            }
          ]
        },
        {
          id: 'resultados',
          title: 'Resultados e Recursos',
          items: [
            {
              question: 'Como é calculada a Nota Final?',
              answer: 'A Nota Final é a média ponderada: (Nota Anteprojeto x 4 + Nota Entrevista x 5 + Nota Língua Estrangeira x 1) / 10.'
            },
            {
              question: 'Como entro com recurso?',
              answer: 'Os recursos devem ser enviados para o e-mail seletivoplanterr@gmail.com utilizando o formulário Anexo XV, dentro dos prazos estabelecidos no Cronograma do Edital.'
            },
            {
              question: 'Onde vejo os resultados?',
              answer: 'Todos os resultados e convocações são divulgados exclusivamente na página do Programa: http://www.planterr.uefs.br.'
            }
          ]
        },
        {
          id: 'cotas',
          title: 'Ações Afirmativas (Cotas)',
          items: [
            {
              question: 'Quais são as vagas reservadas?',
              answer: '50% das vagas são destinadas a ações afirmativas: negros/as, indígenas, quilombolas, ciganos/as, pessoas trans e pessoas com deficiência. Há também 20% para servidores da UEFS e 20% para servidores da SDR.'
            },
            {
              question: 'Como funciona a validação das cotas?',
              answer: 'Candidatos negros passam por Comissão de Heteroidentificação. Indígenas, quilombolas, ciganos, trans e PcD passam por Comissão de Validação Documental. As datas estão no cronograma.'
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
