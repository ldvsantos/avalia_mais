class ListSubmissions {
  constructor(submissionRepository) {
    this.submissionRepository = submissionRepository;
  }

  execute({ q, status, from, to } = {}) {
    const submissions = this.submissionRepository.getAll();
    return this.filterSubmissions(submissions, { q, status, from, to });
  }

  filterSubmissions(submissions, { q, status, from, to }) {
    const qNorm = String(q ?? '').trim().toLowerCase();
    const statusNorm = String(status ?? '').trim();

    return submissions.filter(s => {
      const sStatus = this.normalizeStatus(s.status);

      if (statusNorm && statusNorm !== 'Todos' && sStatus !== statusNorm) return false;

      const createdAt = new Date(s.createdAt);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;

      if (!qNorm) return true;

      const hay = [
        s.protocol,
        s.identified?.nome,
        s.identified?.email,
        s.project?.titulo_pt,
      ].map(val => this.toLower(val)).join(' | ');

      return hay.includes(qNorm);
    });
  }

  normalizeStatus(input) {
    if (!input) return 'Recebida';
    // Mapeamento simples para garantir consistência
    const map = {
      'recebida': 'Recebida',
      'em analise': 'Em Análise',
      'em análise': 'Em Análise',
      'aprovado': 'Aprovado',
      'aprovada': 'Aprovado',
      'reprovado': 'Reprovado',
      'reprovada': 'Reprovado',
      'indeferido': 'Indeferido',
      'indeferida': 'Indeferido',
    };
    return map[String(input).toLowerCase()] || input;
  }

  toLower(s) {
    return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
}

module.exports = ListSubmissions;
