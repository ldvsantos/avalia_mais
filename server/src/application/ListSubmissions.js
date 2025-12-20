class ListSubmissions {
  constructor(submissionRepository) {
    this.submissionRepository = submissionRepository;
  }

  async execute({ q, status, from, to, editalYear } = {}) {
    const submissions = await Promise.resolve(this.submissionRepository.getAll());
    return this.filterSubmissions(submissions, { q, status, from, to, editalYear });
  }

  getYearFromSubmission(s) {
    const y = Number(s && s.editalYear);
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
    const p = String(s && s.protocol || '').trim();
    const m = p.match(/\b(20\d{2})\b/);
    if (m) {
      const yy = Number(m[1]);
      if (Number.isFinite(yy) && yy >= 2000 && yy <= 2100) return yy;
    }
    return null;
  }

  filterSubmissions(submissions, { q, status, from, to, editalYear }) {
    const qNorm = String(q ?? '').trim().toLowerCase();
    const statusNorm = String(status ?? '').trim();
    const yearNorm = editalYear != null ? Number(editalYear) : null;

    return submissions.filter(s => {
      if (yearNorm != null && Number.isFinite(yearNorm)) {
        const sy = this.getYearFromSubmission(s);
        if (sy !== yearNorm) return false;
      }

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
