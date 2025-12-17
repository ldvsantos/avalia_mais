const Appeal = require('../domain/Appeal');
const crypto = require('crypto');

class RegisterAppeal {
  constructor(appealRepository, emailService, emailTemplateService, pdfService) {
    this.appealRepository = appealRepository;
    this.emailService = emailService;
    this.emailTemplateService = emailTemplateService;
    this.pdfService = pdfService;
  }

  async execute(data) {
    const year = new Date().getFullYear();
    const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
    const protocol = `REC-${year}-${randomPart}`;
    const createdAt = new Date().toISOString();

    const appeal = new Appeal({
      protocol,
      createdAt,
      cpf: data.cpf,
      nome: data.nome,
      email: data.email,
      tituloProjeto: data.titulo_projeto,
      linhaPesquisa: data.linha_pesquisa,
      etapa: data.etapa_processo,
      argumentacao: data.argumentacao
    });

    this.appealRepository.save(appeal);

    if (this.emailService && data.email) {
      const subject = `Confirmação de Recurso - Protocolo ${protocol}`;
      const text = `Olá ${data.nome},\n\nSeu recurso foi recebido com sucesso.\nProtocolo: ${protocol}\nEtapa: ${data.etapa_processo}\nData: ${createdAt}\n\nAtenciosamente,\nEquipe AVALIA+`;
      
      let html = null;
      if (this.emailTemplateService) {
        html = this.emailTemplateService.getAppealEmail(data, protocol);
      }

      let attachments = [];
      if (this.pdfService) {
        try {
          const pdfBuffer = await this.pdfService.generateAppealPdf(data, protocol);
          attachments.push({
            filename: `Recurso_${protocol}.pdf`,
            content: pdfBuffer
          });
        } catch (err) {
          console.error('Failed to generate PDF', err);
        }
      }

      this.emailService.sendEmail(data.email, subject, text, html, attachments).catch(err => console.error('Failed to send email', err));
    }

    return {
      protocol,
      createdAt
    };
  }
}

module.exports = RegisterAppeal;
