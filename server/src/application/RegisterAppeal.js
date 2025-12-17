const Appeal = require('../domain/Appeal');
const crypto = require('crypto');

class RegisterAppeal {
  constructor(appealRepository, emailService, emailTemplateService, pdfService, adminNotifyTo) {
    this.appealRepository = appealRepository;
    this.emailService = emailService;
    this.emailTemplateService = emailTemplateService;
    this.pdfService = pdfService;
    this.adminNotifyTo = adminNotifyTo;
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
      decisaoContestacao: data.decisao_contestacao,
      argumentacao: data.argumentacao
    });

    this.appealRepository.save(appeal);

    // Emails (candidato + notificação admin) + PDF (assíncrono)
    const candidateEmail = String(data?.email || '').trim();
    const adminNotifyTo = String(this.adminNotifyTo || '').trim();

    const parseRecipients = (value) =>
      String(value || '')
        .split(/[;,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

    const adminRecipients = parseRecipients(adminNotifyTo);

    if (this.emailService && (candidateEmail || adminRecipients.length > 0)) {
      Promise.resolve()
        .then(async () => {
          let pdfBuffer = null;
          if (this.pdfService && typeof this.pdfService.generateAppealPdf === 'function') {
            try {
              pdfBuffer = await this.pdfService.generateAppealPdf(appeal);
            } catch (err) {
              console.error('Failed to generate appeal PDF', err);
            }
          }

          const attachments = pdfBuffer
            ? [
                {
                  filename: `recurso-${protocol}.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                },
              ]
            : [];

          // Candidato
          if (candidateEmail) {
            const subject = `Confirmação de Recurso - Protocolo ${protocol}`;
            const text =
              `Olá ${data.nome},\n\n` +
              `Seu recurso foi recebido com sucesso.\n` +
              `Protocolo: ${protocol}\n` +
              `Etapa: ${data.etapa_processo}\n` +
              `Data: ${createdAt}\n` +
              (pdfBuffer ? `\nUma cópia em PDF segue em anexo.\n` : `\n`) +
              `\nAtenciosamente,\nEquipe AVALIA+`;

            let html = null;
            if (this.emailTemplateService) {
              html = this.emailTemplateService.getAppealEmail(data, protocol);
            }

            await this.emailService.sendEmail(candidateEmail, subject, text, html, attachments);
          }

          // Admins
          if (adminRecipients.length > 0) {
            const subject = `Novo recurso recebido - ${protocol}`;
            const text =
              `Novo recurso recebido.\n\n` +
              `Protocolo: ${protocol}\n` +
              `Data: ${createdAt}\n` +
              `Candidato: ${data.nome || 'N/A'}\n` +
              `Email: ${candidateEmail || 'N/A'}\n` +
              `Projeto: ${data.titulo_projeto || 'N/A'}\n` +
              `Linha de pesquisa: ${data.linha_pesquisa || 'N/A'}\n` +
              `Etapa: ${data.etapa_processo || 'N/A'}\n`;

            let html = null;
            if (this.emailTemplateService && typeof this.emailTemplateService.getAdminNewAppealNotificationEmail === 'function') {
              const templateData = {
                nome: data.nome,
                email: candidateEmail,
                titulo_projeto: data.titulo_projeto,
                linha_pesquisa: data.linha_pesquisa,
                etapa_processo: data.etapa_processo,
              };
              html = this.emailTemplateService.getAdminNewAppealNotificationEmail(templateData, protocol);
            }

            await this.emailService.sendEmail(adminRecipients.join(','), subject, text, html, attachments);
          }
        })
        .catch((err) => console.error('Failed to send appeal emails', err));
    }

    return {
      protocol,
      createdAt
    };
  }
}

module.exports = RegisterAppeal;
