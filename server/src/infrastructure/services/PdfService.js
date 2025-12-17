const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

class PdfService {
  constructor() {
    // Adjust path to point to src/img/logo_avalia_horizontal.png from server/src/infrastructure/services/
    this.logoPath = path.join(__dirname, '../../../../src/img/logo_avalia_horizontal.png');
  }

  async generateSubmissionPdf(submission) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const protocol = submission?.protocol || 'N/A';
      const createdAt = submission?.createdAt ? new Date(submission.createdAt) : new Date();
      const hash = submission?.hash || '';
      const identified = submission?.identified || {};
      const project = submission?.project || {};

      // Header
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 50, 45, { width: 150 });
      } else {
        doc.fontSize(20).text('Avalia Mais', 50, 50);
      }

      doc.moveDown(4);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Comprovante de Inscrição', { align: 'center' });
      doc.moveDown();

      // Protocol Info
      doc.fontSize(12).font('Helvetica').text(`Protocolo: ${protocol}`, { align: 'right' });
      doc.text(
        `Data: ${createdAt.toLocaleDateString('pt-BR')} ${createdAt.toLocaleTimeString('pt-BR')}`,
        { align: 'right' }
      );
      if (hash) {
        doc.fontSize(10).text(`Hash: ${hash}`, { align: 'right' });
      }
      doc.moveDown(2);

      const writeField = (label, value) => {
        doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
        doc.font('Helvetica').text(String(value || 'N/A'));
      };

      // Applicant Details
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Candidato');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Nome', identified.nome || identified.nome_social);
      if (identified.nome_social) writeField('Nome social', identified.nome_social);
      writeField('CPF', identified.cpf);
      writeField('RG', identified.rg);
      writeField('Órgão expedidor', identified.orgao_expedidor);
      writeField('Data de expedição', identified.data_expedicao);
      writeField('Data de nascimento', identified.data_nascimento);
      writeField('Email', identified.email);
      writeField('Celular', identified.celular);
      writeField('Telefone residencial', identified.telefone_residencial);
      writeField('Endereço', identified.endereco);
      writeField('Cidade/Estado', identified.cidade_estado);
      writeField('CEP', identified.cep);
      writeField('Curso de graduação', identified.curso_graduacao);
      writeField('Instituição', identified.instituicao);
      writeField('Ano de conclusão', identified.ano_conclusao);
      writeField('Vaga institucional', identified.vaga_institucional);
      writeField('Vaga cooperação', identified.vaga_cooperacao);
      writeField('Vaga reservada', identified.vaga_reservada);
      writeField('Cotas', identified.cotas);
      writeField('Raça/Cor', identified.raca_cor);
      writeField('Língua estrangeira', identified.lingua_estrangeira);
      writeField('Vínculo empregatício', identified.vinculo_empregaticio);
      writeField('Carga horária', identified.carga_horaria);
      writeField('Empresa', identified.empresa_vinculo);
      writeField('Termo de compromisso', identified.termo_compromisso);

      doc.moveDown(1.5);

      // Project Details
      doc.fontSize(12).font('Helvetica-Bold').text('Dados do Projeto');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');

      writeField('Título (PT)', project.titulo_pt);
      writeField('Título (EN)', project.titulo_en);
      writeField('Área', project.area);
      writeField('Palavras-chave (PT)', project.palavras_pt);
      writeField('Palavras-chave (EN)', project.palavras_en);

      const writeSection = (title, value) => {
        const text = String(value || '').trim();
        if (!text) return;
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').text(title);
        doc.moveDown(0.3);
        doc.font('Helvetica').text(text, { align: 'justify' });
      };

      writeSection('Resumo', project.resumo);
      writeSection('Justificativa / Enquadramento', project.justificativa_enquadramento);
      writeSection('Introdução', project.introducao);
      writeSection('Problema de pesquisa', project.problema_pesquisa);
      writeSection('Justificativa / Relevância', project.justificativa_relevancia);
      writeSection('Objetivo geral', project.objetivo_geral);
      writeSection('Objetivos específicos', project.objetivos_especificos);
      writeSection('Objetivos (campo alternativo)', project.objetivos);
      writeSection('Metas', project.metas);
      writeSection('Revisão de literatura', project.revisao_literatura);
      writeSection('Procedimentos metodológicos', project.procedimentos_metodologicos);
      writeSection('Cronograma', project.cronograma);
      writeSection('Referências', project.referencias);

      // Footer
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.text('', 50, doc.page.height - 50);
      doc.fontSize(8).text('Este documento foi gerado automaticamente pelo sistema Avalia Mais.', { align: 'center' });
      doc.page.margins.bottom = bottom;

      doc.end();
    });
  }

  async generateAppealPdf(data, protocol) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      doc.on('error', (err) => {
        reject(err);
      });

      // Header
      if (fs.existsSync(this.logoPath)) {
        doc.image(this.logoPath, 50, 45, { width: 150 });
      } else {
        doc.fontSize(20).text('Avalia Mais', 50, 50);
      }

      doc.moveDown(4);

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Comprovante de Registro de Recurso', { align: 'center' });
      doc.moveDown();

      // Protocol Info
      doc.fontSize(12).font('Helvetica').text(`Protocolo: ${protocol}`, { align: 'right' });
      doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, { align: 'right' });
      doc.moveDown(2);

      // Applicant Details
      doc.font('Helvetica-Bold').text('Dados do Solicitante');
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10);
      
      const fields = [
        { label: 'Nome', value: data.nome },
        { label: 'CPF', value: data.cpf },
        { label: 'Email', value: data.email },
        { label: 'Projeto', value: data.titulo_projeto },
        { label: 'Linha de Pesquisa', value: data.linha_pesquisa }
      ];

      fields.forEach(field => {
        doc.font('Helvetica-Bold').text(`${field.label}: `, { continued: true });
        doc.font('Helvetica').text(field.value || 'N/A');
      });

      doc.moveDown(2);

      // Appeal Details
      doc.fontSize(12).font('Helvetica-Bold').text('Detalhes do Recurso');
      doc.moveDown(0.5);
      
      doc.fontSize(10).font('Helvetica-Bold').text('Etapa Questionada: ', { continued: true });
      doc.font('Helvetica').text(data.etapa_processo);
      doc.moveDown();

      doc.font('Helvetica-Bold').text('Argumentação:');
      doc.moveDown(0.5);
      doc.font('Helvetica').text(data.argumentacao, {
        align: 'justify'
      });

      // Footer
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.text('', 50, doc.page.height - 50);
      doc.fontSize(8).text('Este documento foi gerado automaticamente pelo sistema Avalia Mais.', { align: 'center' });
      doc.page.margins.bottom = bottom;

      doc.end();
    });
  }
}

module.exports = PdfService;
