const Submission = require('../domain/Submission');
const crypto = require('crypto');

class RegisterSubmission {
  constructor(submissionRepository, hmacSecret) {
    this.submissionRepository = submissionRepository;
    this.hmacSecret = hmacSecret;
  }

  execute(data) {
    // 1. Generate Protocol
    const year = new Date().getFullYear();
    const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
    const protocol = `PLANTERR-${year}-${randomPart}`;

    // 2. Generate Hash
    const canonicalString = `${protocol}|${data.cpf}|${data.email}|${data.titulo_pt}`;
    const hash = crypto.createHmac('sha256', this.hmacSecret).update(canonicalString).digest('hex');

    // 3. Generate CPF Hash (for uniqueness check)
    const cpfHash = crypto.createHash('sha256').update(data.cpf).digest('hex');

    // 4. Check Uniqueness
    if (this.submissionRepository.existsCpfHash(cpfHash)) {
      throw new Error('CPF já possui inscrição registrada.');
    }

    // 5. Create Entity
    const submission = new Submission({
      protocol,
      hash,
      cpfHash,
      cpfLast4: data.cpf.slice(-4),
      identified: {
        nome: data.nome,
        nome_social: data.nome_social,
        email: data.email,
        // ... map other fields
      },
      blind: {
        titulo_pt: data.titulo_pt,
        area: data.area,
        // ... map other fields
      }
    });

    // 6. Save
    this.submissionRepository.save(submission);

    return {
      protocol,
      hash,
      createdAt: submission.createdAt
    };
  }
}

module.exports = RegisterSubmission;
