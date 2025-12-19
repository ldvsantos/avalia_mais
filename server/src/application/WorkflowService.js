const PHASE = {
  INSCRICAO: 'INSCRICAO',
  RECURSO_INSCRICAO: 'RECURSO_INSCRICAO',
  PROJETO: 'PROJETO',
  RECURSO_PROJETO: 'RECURSO_PROJETO',
  ENTREVISTA: 'ENTREVISTA',
  RECURSO_ENTREVISTA: 'RECURSO_ENTREVISTA',
  LINGUA: 'LINGUA',
  RECURSO_LINGUA: 'RECURSO_LINGUA',
};

const STATUS = {
  APROVADO: 'APROVADO',
  REPROVADO_PRELIMINAR: 'REPROVADO_PRELIMINAR',
  REPROVADO_DEFINITIVO: 'REPROVADO_DEFINITIVO',
};

const APPEAL_STATUS = {
  RECEBIDO: 'Recebido',
  DEFERIDO: 'Deferido',
  INDEFERIDO: 'Indeferido',
};

function parseYearFromSubmissionProtocol(protocol) {
  const p = String(protocol || '').trim();
  const m = p.match(/\b(20\d{2})\b/);
  if (m) return Number(m[1]);
  return new Date().getFullYear();
}

function toDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isWithin(now, window) {
  const start = toDate(window?.startISO);
  const end = toDate(window?.endISO);
  if (!start || !end) return false;
  return now >= start && now <= end;
}

function normalizeEtapaToParentPhase(etapaLabel) {
  const label = String(etapaLabel || '').trim().toLowerCase();
  if (!label) return null;

  if (label.includes('inscri')) return PHASE.INSCRICAO;
  if (label.includes('projeto')) return PHASE.PROJETO;
  if (label.includes('entrevista')) return PHASE.ENTREVISTA;
  if (label.includes('língua') || label.includes('lingua') || label.includes('estrangeira')) return PHASE.LINGUA;

  return null;
}

function mapParentToAppealPhase(parentPhaseKey) {
  switch (parentPhaseKey) {
    case PHASE.INSCRICAO:
      return PHASE.RECURSO_INSCRICAO;
    case PHASE.PROJETO:
      return PHASE.RECURSO_PROJETO;
    case PHASE.ENTREVISTA:
      return PHASE.RECURSO_ENTREVISTA;
    case PHASE.LINGUA:
      return PHASE.RECURSO_LINGUA;
    default:
      return null;
  }
}

function previousEvaluativePhase(phaseKey) {
  switch (phaseKey) {
    case PHASE.PROJETO:
      return PHASE.INSCRICAO;
    case PHASE.ENTREVISTA:
      return PHASE.PROJETO;
    case PHASE.LINGUA:
      return PHASE.ENTREVISTA;
    default:
      return null;
  }
}

class WorkflowService {
  constructor({ calendarRepo, statusRepo, appealRepo, submissionRepo, evaluationRepo, storageCompat }) {
    this.calendarRepo = calendarRepo;
    this.statusRepo = statusRepo;
    this.appealRepo = appealRepo;
    this.submissionRepo = submissionRepo;
    this.evaluationRepo = evaluationRepo;
    this.storageCompat = storageCompat;
  }

  getEditalYearForSubmission(submissionProtocol) {
    return parseYearFromSubmissionProtocol(submissionProtocol);
  }

  getCalendar(year) {
    const seed = this.storageCompat && typeof this.storageCompat.getRegistrationWindow === 'function'
      ? this.storageCompat.getRegistrationWindow()
      : null;
    return this.calendarRepo.getOrCreateYear(year, { seedRegistrationWindow: seed });
  }

  assertWithinGlobal(year, now) {
    const cal = this.getCalendar(year);
    if (!isWithin(now, cal.global)) {
      throw new Error('Fora do período global do edital.');
    }
  }

  assertWithinPhase(year, phaseKey, now) {
    const cal = this.getCalendar(year);
    const window = cal?.phases?.[phaseKey];
    if (!isWithin(now, window)) {
      throw new Error('Fora do prazo da fase.');
    }
  }

  async getStatus(year, submissionProtocol, phaseKey) {
    const protocol = String(submissionProtocol || '').trim();
    const phase = String(phaseKey || '').trim();
    if (!protocol || !phase) return null;

    const stored = await Promise.resolve(this.statusRepo.find(year, protocol, phase));

    // INSCRICAO: re-deriva do status atual da inscrição, exceto quando já houver
    // uma consolidação/decisão de recurso persistida.
    if (phase === PHASE.INSCRICAO) {
      const storedReason = stored?.meta && typeof stored.meta === 'object' ? String(stored.meta?.reason || '') : '';
      const isAppealDecision = storedReason.startsWith('recurso_');

      if (stored && stored.status === STATUS.REPROVADO_DEFINITIVO) return stored.status;
      if (stored && stored.status && isAppealDecision) return stored.status;

      const s = this.submissionRepo && typeof this.submissionRepo.findByProtocol === 'function'
        ? await Promise.resolve(this.submissionRepo.findByProtocol(protocol))
        : null;
      if (!s) return stored?.status || null;

      const rawStatus = String(s?.status || '').toLowerCase();
      // Indeferimento de inscrição é tratado como reprovação preliminar, permitindo recurso.
      const derived = rawStatus.includes('indefer') ? STATUS.REPROVADO_PRELIMINAR : STATUS.APROVADO;

      if (!stored || stored.status !== derived) {
        await this.setStatus(year, protocol, PHASE.INSCRICAO, derived);
      }
      return derived;
    }

    if (stored && stored.status) return stored.status;

    // Compat/legado: deriva status a partir dos dados já existentes

    const e = this.evaluationRepo && typeof this.evaluationRepo.findByProtocol === 'function'
      ? await Promise.resolve(this.evaluationRepo.findByProtocol(protocol))
      : (this.storageCompat && typeof this.storageCompat.getEvaluation === 'function'
          ? await Promise.resolve(this.storageCompat.getEvaluation(protocol))
          : null);

    const scoreFromEval = (evalObj, key) => {
      if (!evalObj) return null;
      const v = evalObj[key];
      if (v != null) return Number(v);
      return null;
    };

    if (phase === PHASE.PROJETO) {
      const score = scoreFromEval(e, 'proj_total');
      if (score == null || Number.isNaN(score)) return null;
      const derived = score < 7.0 ? STATUS.REPROVADO_PRELIMINAR : STATUS.APROVADO;
      await this.setStatus(year, protocol, PHASE.PROJETO, derived, { score });
      return derived;
    }

    if (phase === PHASE.ENTREVISTA) {
      const score = scoreFromEval(e, 'int_total');
      if (score == null || Number.isNaN(score)) return null;
      const derived = score < 7.0 ? STATUS.REPROVADO_PRELIMINAR : STATUS.APROVADO;
      await this.setStatus(year, protocol, PHASE.ENTREVISTA, derived, { score });
      return derived;
    }

    if (phase === PHASE.LINGUA) {
      const score = scoreFromEval(e, 'lang_total');
      if (score == null || Number.isNaN(score)) return null;
      const derived = score < 7.0 ? STATUS.REPROVADO_PRELIMINAR : STATUS.APROVADO;
      await this.setStatus(year, protocol, PHASE.LINGUA, derived, { score });
      return derived;
    }

    return null;
  }

  async setStatus(year, submissionProtocol, phaseKey, status, { score, meta } = {}) {
    return await Promise.resolve(this.statusRepo.upsert({
      year,
      submissionProtocol,
      phaseKey,
      status,
      score: score != null ? Number(score) : null,
      meta,
    }));
  }

  async ensureNotDefinitiveFail(year, submissionProtocol) {
    const phases = [PHASE.INSCRICAO, PHASE.PROJETO, PHASE.ENTREVISTA, PHASE.LINGUA];
    for (const phaseKey of phases) {
      const st = await this.getStatus(year, submissionProtocol, phaseKey);
      if (st === STATUS.REPROVADO_DEFINITIVO) {
        throw new Error('Candidato reprovado definitivamente, não pode prosseguir.');
      }
    }
  }

  assertCanRegisterSubmission(now) {
    const year = now.getFullYear();
    this.assertWithinGlobal(year, now);
    this.assertWithinPhase(year, PHASE.INSCRICAO, now);
  }

  async assertCanSubmitAppeal({ submissionProtocol, etapaLabel, now }) {
    const year = this.getEditalYearForSubmission(submissionProtocol);

    this.assertWithinGlobal(year, now);
    await this.ensureNotDefinitiveFail(year, submissionProtocol);

    const parentPhase = normalizeEtapaToParentPhase(etapaLabel);
    if (!parentPhase) {
      throw new Error('Etapa do recurso inválida.');
    }

    const appealPhase = mapParentToAppealPhase(parentPhase);
    if (!appealPhase) {
      throw new Error('Etapa do recurso inválida.');
    }

    this.assertWithinPhase(year, appealPhase, now);

    // Recurso só é permitido se estiver REPROVADO_PRELIMINAR na fase pai.
    const parentStatus = await this.getStatus(year, submissionProtocol, parentPhase);
    if (parentStatus !== STATUS.REPROVADO_PRELIMINAR) {
      throw new Error('Recurso não permitido: fora do prazo ou candidato não está em reprovação preliminar na etapa informada.');
    }

    return { year, parentPhase, appealPhase };
  }

  async assertCanEvaluatePhase({ submissionProtocol, phaseKey, now }) {
    const year = this.getEditalYearForSubmission(submissionProtocol);
    this.assertWithinGlobal(year, now);
    await this.ensureNotDefinitiveFail(year, submissionProtocol);
    this.assertWithinPhase(year, phaseKey, now);

    const prev = previousEvaluativePhase(phaseKey);
    if (prev) {
      const prevStatus = await this.getStatus(year, submissionProtocol, prev);
      if (prevStatus !== STATUS.APROVADO) {
        throw new Error('Candidato não aprovado na fase anterior, avaliação bloqueada.');
      }
    }

    // Para PROJETO, apenas garante que existe inscrição.
    if (phaseKey === PHASE.PROJETO) {
      const s = await Promise.resolve(this.submissionRepo.findByProtocol(submissionProtocol));
      if (!s) throw new Error('Inscrição não encontrada.');
    }

    return { year };
  }

  async applyCutoffAndPersist({ year, submissionProtocol, phaseKey, score }) {
    const numeric = score != null ? Number(score) : null;
    if (numeric == null || Number.isNaN(numeric)) return null;

    if (numeric < 7.0) {
      return await this.setStatus(year, submissionProtocol, phaseKey, STATUS.REPROVADO_PRELIMINAR, { score: numeric });
    }
    return await this.setStatus(year, submissionProtocol, phaseKey, STATUS.APROVADO, { score: numeric });
  }

  async reconcileDefinitiveFailures({ year, now }) {
    // Se estiver preliminar e prazo de recurso expirou:
    // - se não enviou recurso => definitivo
    // - se enviou e indeferido => definitivo
    // - se deferido => aprovado

    // Garante que a fase INSCRICAO existe para os candidatos do ano (derivada do status da inscrição)
    try {
      const submissions = this.submissionRepo && typeof this.submissionRepo.findAll === 'function'
        ? await Promise.resolve(this.submissionRepo.findAll())
        : [];
      for (const s of submissions) {
        const protocol = String(s?.protocol || '').trim();
        if (!protocol) continue;
        if (this.getEditalYearForSubmission(protocol) !== Number(year)) continue;
        await this.getStatus(year, protocol, PHASE.INSCRICAO);
      }
    } catch {
      // não bloqueia a reconciliação
    }

    const allStatuses = await Promise.resolve(this.statusRepo.findAll());
    const candidates = (allStatuses || []).filter((s) => Number(s?.year) === Number(year));

    const bySubmission = new Map();
    for (const s of candidates) {
      const p = String(s?.submissionProtocol || '').trim();
      if (!p) continue;
      if (!bySubmission.has(p)) bySubmission.set(p, []);
      bySubmission.get(p).push(s);
    }

    const phases = [PHASE.INSCRICAO, PHASE.PROJETO, PHASE.ENTREVISTA, PHASE.LINGUA];

    for (const [submissionProtocol, list] of bySubmission.entries()) {
      for (const phaseKey of phases) {
        const st = list.find((x) => String(x?.phaseKey || '') === phaseKey);
        if (!st || st.status !== STATUS.REPROVADO_PRELIMINAR) continue;

        const appealPhase = mapParentToAppealPhase(phaseKey);
        const cal = this.getCalendar(year);
        const appealWindow = cal?.phases?.[appealPhase];
        if (!appealWindow) continue;

        const appealEnd = toDate(appealWindow.endISO);
        if (!appealEnd || now <= appealEnd) continue;

        const appeals = typeof this.appealRepo.findBySubmissionProtocol === 'function'
          ? await Promise.resolve(this.appealRepo.findBySubmissionProtocol(submissionProtocol))
          : [];

        const hasPhaseAppeal = (appeals || []).filter((a) => normalizeEtapaToParentPhase(a?.etapa) === phaseKey);
        if (hasPhaseAppeal.length === 0) {
          await this.setStatus(year, submissionProtocol, phaseKey, STATUS.REPROVADO_DEFINITIVO, { meta: { reason: 'recurso_nao_enviado' } });
          continue;
        }

        const latest = hasPhaseAppeal[0];
        const appealStatus = String(latest?.status || APPEAL_STATUS.RECEBIDO);
        if (appealStatus.toLowerCase().includes('indefer')) {
          await this.setStatus(year, submissionProtocol, phaseKey, STATUS.REPROVADO_DEFINITIVO, { meta: { reason: 'recurso_indeferido', appealProtocol: latest?.protocol } });
        } else if (appealStatus.toLowerCase().includes('defer')) {
          await this.setStatus(year, submissionProtocol, phaseKey, STATUS.APROVADO, { meta: { reason: 'recurso_deferido', appealProtocol: latest?.protocol } });
        }
      }
    }
  }
}

module.exports = {
  WorkflowService,
  PHASE,
  STATUS,
  APPEAL_STATUS,
  normalizeEtapaToParentPhase,
};
