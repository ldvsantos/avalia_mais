class ListAppeals {
  constructor(appealRepository) {
    this.appealRepository = appealRepository;
  }

  execute({ q, from, to } = {}) {
    const appeals = typeof this.appealRepository.findAll === 'function' ? this.appealRepository.findAll() : [];
    const filtered = this.filterAppeals(appeals, { q, from, to });
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  filterAppeals(appeals, { q, from, to }) {
    const qNorm = this.toLower(String(q ?? '').trim());

    return (appeals || []).filter((a) => {
      const createdAt = new Date(a.createdAt);
      if (from && createdAt < from) return false;
      if (to && createdAt > to) return false;

      if (!qNorm) return true;

      const hay = [
        a.protocol,
        a.nome,
        a.email,
        a.cpf,
        a.tituloProjeto,
        a.linhaPesquisa,
        a.etapa,
      ].map((val) => this.toLower(val)).join(' | ');

      return hay.includes(qNorm);
    });
  }

  toLower(s) {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}

module.exports = ListAppeals;
