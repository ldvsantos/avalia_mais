const Appeal = require('../domain/Appeal');
const crypto = require('crypto');

class RegisterAppeal {
  constructor(appealRepository, submissionRepository, emailService, emailTemplateService, pdfService, adminNotifyTo) {
    this.appealRepository = appealRepository;
    this.submissionRepository = submissionRepository;
    this.emailService = emailService;
    this.emailTemplateService = emailTemplateService;
    this.pdfService = pdfService;
    this.adminNotifyTo = adminNotifyTo;
  }

  normalizeDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  async execute(data, ctx) {
    const submissionProtocol = String(data?.protocolo_inscricao || data?.submissionProtocol || '').trim();
    if (!submissionProtocol) {
      throw new Error('Informe o protocolo de inscrição.');
    }

    if (!this.submissionRepository || typeof this.submissionRepository.findByProtocol !== 'function') {
      throw new Error('Repositório de inscrições não configurado.');
    }

    const submission = this.submissionRepository.findByProtocol(submissionProtocol);
    if (!submission) {
      throw new Error('Protocolo de inscrição não encontrado.');
    }

    const cpfForm = this.normalizeDigits(data?.cpf);
    const cpfSubmission = this.normalizeDigits(submission?.identified?.cpf || submission?.cpf || '');
    if (cpfForm && cpfSubmission && cpfForm !== cpfSubmission) {
      throw new Error('CPF não confere com a inscrição informada.');
    }

    const etapa = String(data?.etapa_processo || '').trim();
    if (!etapa) {
      throw new Error('Selecione a etapa do processo.');
    }

    const year = new Date().getFullYear();
    const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
    const protocol = `REC-${year}-${randomPart}`;
    const createdAt = new Date().toISOString();

    const submissionProject = submission?.project || submission?.blind || {};
    const tituloProjeto = String(data?.titulo_projeto || submissionProject?.titulo_pt || submissionProject?.titulo || '').trim();
    const linhaPesquisa = String(data?.linha_pesquisa || submissionProject?.area || submissionProject?.linha_pesquisa || '').trim();

    const appeal = new Appeal({
      protocol,
      submissionProtocol,
      createdAt,
      cpf: data.cpf,
      nome: data.nome,
      email: data.email,
      tituloProjeto,
      linhaPesquisa,
      etapa,
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
              pdfBuffer = await this.pdfService.generateAppealPdf(appeal, ctx);
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
              `Protocolo de inscrição: ${submissionProtocol}\n` +
              `Etapa: ${etapa}\n` +
              `Data: ${createdAt}\n` +
              (pdfBuffer ? `\nUma cópia em PDF segue em anexo.\n` : `\n`) +
              `\nAtenciosamente,\nEquipe AVALIA+`;

            let html = null;
            if (this.emailTemplateService) {
              html = this.emailTemplateService.getAppealEmail(
                {
                  ...data,
                  protocolo_inscricao: submissionProtocol,
                  titulo_projeto: tituloProjeto,
                  linha_pesquisa: linhaPesquisa,
                  etapa_processo: etapa,
                },
                protocol
              );
            }

            const ok = await this.emailService.sendEmail(candidateEmail, subject, text, html, attachments);
            if (!ok) {
              console.error(`[EMAIL] Falha ao enviar confirmação de recurso para candidato. appeal=${protocol} submission=${submissionProtocol} to=${candidateEmail}`);
            } else {
              console.log(`[EMAIL] Confirmação de recurso enviada para candidato. appeal=${protocol} submission=${submissionProtocol} to=${candidateEmail}`);
            }
          }

          // Admins
          if (adminRecipients.length > 0) {
            const subject = `Novo recurso recebido - ${protocol}`;
            const text =
              `Novo recurso recebido.\n\n` +
              `Protocolo: ${protocol}\n` +
              `Protocolo de inscrição: ${submissionProtocol}\n` +
              `Data: ${createdAt}\n` +
              `Candidato: ${data.nome || 'N/A'}\n` +
              `Email: ${candidateEmail || 'N/A'}\n` +
              `Projeto: ${tituloProjeto || 'N/A'}\n` +
              `Linha de pesquisa: ${linhaPesquisa || 'N/A'}\n` +
              `Etapa: ${etapa || 'N/A'}\n`;

            let html = null;
            if (this.emailTemplateService && typeof this.emailTemplateService.getAdminNewAppealNotificationEmail === 'function') {
              const templateData = {
                nome: data.nome,
                email: candidateEmail,
                titulo_projeto: tituloProjeto,
                linha_pesquisa: linhaPesquisa,
                etapa_processo: etapa,
                protocolo_inscricao: submissionProtocol,
              };
              html = this.emailTemplateService.getAdminNewAppealNotificationEmail(templateData, protocol);
            }

            const toAdmins = adminRecipients.join(',');
            const ok = await this.emailService.sendEmail(toAdmins, subject, text, html, attachments);
            if (!ok) {
              console.error(`[EMAIL] Falha ao enviar notificação de novo recurso para admin. appeal=${protocol} submission=${submissionProtocol} to=${toAdmins}`);
            } else {
              console.log(`[EMAIL] Notificação de novo recurso enviada para admin. appeal=${protocol} submission=${submissionProtocol} to=${toAdmins}`);
            }
          }
        })
        .catch((err) => console.error('Failed to send appeal emails', err));
    }

    return {
      protocol,
      createdAt,
      submissionProtocol,
      etapa
    };
  }
}

module.exports = RegisterAppeal;
