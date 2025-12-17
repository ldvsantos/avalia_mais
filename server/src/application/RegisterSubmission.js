const Submission = require('../domain/Submission');
const crypto = require('crypto');

const { stableStringify, sha256Hex } = require('../../util');

class RegisterSubmission {
  constructor(submissionRepository, hmacSecret, emailService) {
    this.submissionRepository = submissionRepository;
    this.hmacSecret = hmacSecret;
    this.emailService = emailService;
  }

  async execute(data) {
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
    if (this.submissionRepository.existsCpfHash(cpfHash)) {
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
    this.submissionRepository.save(submission);

    // 7. Send Email
    if (this.emailService && identified.email) {
      const subject = `Confirmação de Inscrição - Protocolo ${protocol}`;
      const text = `Olá ${identified.nome},\n\nSua inscrição foi recebida com sucesso.\nProtocolo: ${protocol}\nData: ${createdAt}\n\nAtenciosamente,\nEquipe AVALIA+`;
      // Fire and forget email to not block response too much, or await if critical
      this.emailService.sendEmail(identified.email, subject, text).catch(err => console.error('Failed to send email', err));
    }

    return {
      protocol,
      hash,
      createdAt: submission.createdAt,
    };
  }
}

module.exports = RegisterSubmission;
