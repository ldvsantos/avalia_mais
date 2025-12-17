const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

class PdfService {
  constructor() {
    // Adjust path to point to src/img/logo_avalia_horizontal.png from server/src/infrastructure/services/
    this.logoPath = path.join(__dirname, '../../../../src/img/logo_avalia_horizontal.png');
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
