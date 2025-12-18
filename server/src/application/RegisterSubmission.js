const Submission = require('../domain/Submission');
const crypto = require('crypto');

const { stableStringify, sha256Hex } = require('../../util');

class RegisterSubmission {
  constructor(submissionRepository, hmacSecret, emailService, emailTemplateService, pdfService, adminNotifyTo) {
    this.submissionRepository = submissionRepository;
    this.hmacSecret = hmacSecret;
    this.emailService = emailService;
    this.emailTemplateService = emailTemplateService;
    this.pdfService = pdfService;
    this.adminNotifyTo = adminNotifyTo;
  }

  async execute(data, ctx) {
    console.log('RegisterSubmission.execute called with ctx:', ctx);
    // 1. Generate Protocol
    const year = new Date().getFullYear();
    const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
    const protocol = `PLANTERR-${year}-${randomPart}`;

    const createdAt = new Date().toISOString();

    const cpfRaw = String(data?.cpf ?? '');
    const cpfDigits = cpfRaw.replace(/\D/g, '');

    const identified = {
      nome: data?.nome || '',
      nome_social: data?.nome_social || '',
      data_nascimento: data?.data_nascimento || '',
      cpf: cpfDigits || cpfRaw,
      rg: data?.rg || '',
      orgao_expedidor: data?.orgao_expedidor || '',
      data_expedicao: data?.data_expedicao || '',
      endereco: data?.endereco || '',
      cidade_estado: data?.cidade_estado || '',
      cep: data?.cep || '',
      celular: data?.celular || '',
      telefone_residencial: data?.telefone_residencial || '',
      email: data?.email || '',
      curso_graduacao: data?.curso_graduacao || '',
      instituicao: data?.instituicao || '',
      ano_conclusao: data?.ano_conclusao || '',
      vaga_institucional: data?.vaga_institucional || '',
      vaga_cooperacao: data?.vaga_cooperacao || '',
      vaga_reservada: data?.vaga_reservada || '',
      cotas: data?.cotas || '',
      raca_cor: data?.raca_cor || '',
      lingua_estrangeira: data?.lingua_estrangeira || '',
      vinculo_empregaticio: data?.vinculo_empregaticio || '',
      carga_horaria: data?.carga_horaria || '',
      empresa_vinculo: data?.empresa_vinculo || '',
      termo_compromisso: data?.termo_compromisso || '',
    };

    const project = {
      titulo_pt: data?.titulo_pt || '',
      titulo_en: data?.titulo_en || '',
      area: data?.area || '',
      palavras_pt: data?.palavras_pt || '',
      palavras_en: data?.palavras_en || '',
      resumo: data?.resumo || '',
      justificativa_enquadramento: data?.justificativa_enquadramento || '',
      introducao: data?.introducao || '',
      problema_pesquisa: data?.problema_pesquisa || '',
      justificativa_relevancia: data?.justificativa_relevancia || '',
      objetivo_geral: data?.objetivo_geral || '',
      objetivos_especificos: data?.objetivos_especificos || '',
      objetivos_geral_especificos: data?.objetivos_geral_especificos || '',
      revisao_literatura: data?.revisao_literatura || '',
      procedimentos_metodologicos: data?.procedimentos_metodologicos || '',
      cronograma: data?.cronograma || '',
      referencias: data?.referencias || '',
      objetivos: data?.objetivos || '',
      metas: data?.metas || '',
    };

    const formVersion = data?.form_version || data?.formVersion || '';

    // 2. Generate Hash (determinístico a partir do que foi registrado)
    const payloadForHash = {
      protocol,
      createdAt,
      form_version: formVersion,
      identified,
      project,
    };
    const hash = sha256Hex(stableStringify(payloadForHash));

    // 3. Generate CPF Hash (for uniqueness check)
    const cpfHash = crypto.createHash('sha256').update(cpfDigits).digest('hex');

    // 4. Check Uniqueness
    const cpfExists = await Promise.resolve(this.submissionRepository.existsCpfHash(cpfHash));
    if (cpfExists) {
      throw new Error('CPF já possui inscrição registrada.');
    }

    // 5. Create Entity
    const submission = new Submission({
      protocol,
      hash,
      createdAt,
      status: 'Recebido',
      cpfHash,
      cpfLast4: cpfDigits.slice(-4),
      formVersion,
      identified,
      project,
      blind: project,
    });

    // 6. Save
    await Promise.resolve(this.submissionRepository.save(submission));

    // 7. Emails (candidato + notificação admin) + PDF (assíncrono)
    const candidateEmail = String(identified.email || '').trim();
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
          if (this.pdfService && typeof this.pdfService.generateSubmissionPdf === 'function') {
            try {
              pdfBuffer = await this.pdfService.generateSubmissionPdf(submission, ctx);
            } catch (err) {
              console.error('Failed to generate submission PDF', err);
            }
          }

          const attachments = pdfBuffer
            ? [
                {
                  filename: `inscricao-${protocol}.pdf`,
                  content: pdfBuffer,
                  contentType: 'application/pdf',
                },
              ]
            : [];

          // Candidato
          if (candidateEmail) {
            const subject = `Confirmação de Inscrição - Protocolo ${protocol}`;
            const text =
              `Olá ${identified.nome},\n\n` +
              `Sua inscrição foi recebida com sucesso.\n` +
              `Protocolo: ${protocol}\n` +
              `Data: ${createdAt}\n` +
              (pdfBuffer ? `\nO comprovante em PDF segue em anexo.\n` : `\n`) +
              `\nAtenciosamente,\nEquipe AVALIA+`;

            let html = null;
            if (this.emailTemplateService) {
              const templateData = {
                nome: identified.nome,
                titulo_projeto: project.titulo_pt || project.titulo_en,
              };
              html = this.emailTemplateService.getRegistrationEmail(templateData, protocol);
            }

            const ok = await this.emailService.sendEmail(candidateEmail, subject, text, html, attachments);
            if (!ok) {
              console.error(`[EMAIL] Falha ao enviar confirmação de inscrição para candidato. protocol=${protocol} to=${candidateEmail}`);
            } else {
              console.log(`[EMAIL] Confirmação de inscrição enviada para candidato. protocol=${protocol} to=${candidateEmail}`);
            }
          }

          // Admins
          if (adminRecipients.length > 0) {
            const subject = `Nova inscrição recebida - ${protocol}`;
            const text =
              `Nova inscrição recebida.\n\n` +
              `Protocolo: ${protocol}\n` +
              `Data: ${createdAt}\n` +
              `Candidato: ${identified.nome || 'N/A'}\n` +
              `Email: ${candidateEmail || 'N/A'}\n` +
              `Projeto: ${project.titulo_pt || project.titulo_en || 'N/A'}\n`;

            let html = null;
            if (this.emailTemplateService && typeof this.emailTemplateService.getAdminNewSubmissionNotificationEmail === 'function') {
              const templateData = {
                nome: identified.nome,
                email: candidateEmail,
                titulo_projeto: project.titulo_pt || project.titulo_en,
              };
              html = this.emailTemplateService.getAdminNewSubmissionNotificationEmail(templateData, protocol);
            }

            const toAdmins = adminRecipients.join(',');
            const ok = await this.emailService.sendEmail(toAdmins, subject, text, html, attachments);
            if (!ok) {
              console.error(`[EMAIL] Falha ao enviar notificação de nova inscrição para admin. protocol=${protocol} to=${toAdmins}`);
            } else {
              console.log(`[EMAIL] Notificação de nova inscrição enviada para admin. protocol=${protocol} to=${toAdmins}`);
            }
          }
        })
        .catch((err) => console.error('Failed to send submission emails', err));
    }

    return {
      protocol,
      hash,
      createdAt: submission.createdAt,
      ip: ctx?.ip,
      user: ctx?.user
    };
  }
}

module.exports = RegisterSubmission;
