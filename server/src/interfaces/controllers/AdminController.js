const { parseDateRange, csvEscape, formatPtBrDateTime } = require('../../../util');
const storage = require('../../../storage');
const { getRequestContext } = require('../../../request-context');
const { logDataExport } = require('../../../security-logger');

class AdminController {
  constructor(listSubmissionsUseCase, listEvaluationsUseCase, listAppealsUseCase, adminDashboardPresenter, calendarRepo, publicFileRepo) {
    this.listSubmissionsUseCase = listSubmissionsUseCase;
    this.listEvaluationsUseCase = listEvaluationsUseCase;
    this.listAppealsUseCase = listAppealsUseCase;
    this.adminDashboardPresenter = adminDashboardPresenter;
    this.calendarRepo = calendarRepo;
    this.publicFileRepo = publicFileRepo;
  }

  async index(req, res) {
    const html = this.adminDashboardPresenter.renderIndex();
    res.type('html').send(html);
  }

  async dashboard(req, res) {
    const q = String(req.query.q ?? '');
    const status = String(req.query.status ?? '');
    const fromStr = String(req.query.from ?? '');
    const toStr = String(req.query.to ?? '');
    const { from, to } = parseDateRange(fromStr, toStr);

    const activeEditalYear = storage.getActiveEditalYear();
    const yearParam = String(req.query.year ?? '').trim();
    const selectedYear = (() => {
      if (!yearParam) return activeEditalYear;
      const y = Number(yearParam);
      if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
      return activeEditalYear;
    })();

    const submissions = await Promise.resolve(this.listSubmissionsUseCase.execute({ q, status, from, to, editalYear: selectedYear }));
    const evaluations = await Promise.resolve(this.listEvaluationsUseCase.execute());
    const publicFiles = this.publicFileRepo ? await Promise.resolve(this.publicFileRepo.getAll()) : [];

    const cal = this.calendarRepo.getOrCreateYear(selectedYear, { seedRegistrationWindow: storage.getRegistrationWindow() });
    
    // Usar período global do calendário em vez da janela de inscrição
    const window = cal?.global || storage.getRegistrationWindow();
    const now = new Date();
    const open = window?.startISO && window?.endISO && 
                 now >= new Date(window.startISO) && 
                 now <= new Date(window.endISO);

    const html = this.adminDashboardPresenter.render(submissions, evaluations, {
      q,
      status,
      fromStr,
      toStr,
      adminStatusOptions: ['Recebida', 'Em Análise', 'Em recurso', 'Aprovada', 'Indeferida'],
      registrationWindow: window,
      registrationOpen: open,
      editalYear: selectedYear,
      activeEditalYear,
      publicFiles,
    });

    res.type('html').send(html);
  }

  async allocateVacancies(req, res) {
    const vagasLinha1 = Number(req.body.vagasLinha1 || 0);
    const vagasLinha2 = Number(req.body.vagasLinha2 || 0);
    
    // Se vier totalVagas (legado ou único), assume divisão igual ou erro?
    // Vamos focar nos novos campos.

    const activeEditalYear = storage.getActiveEditalYear();
    const submissions = await Promise.resolve(this.listSubmissionsUseCase.execute({ editalYear: activeEditalYear }));
    const evaluations = await Promise.resolve(this.listEvaluationsUseCase.execute());
    const evalMap = new Map(evaluations.map(e => [e.protocol, e]));

    const WEIGHTS = { project: 4, interview: 5, language: 1 };
    const MAX = { project: 10, interview: 10, language: 10 };

    const candidatos = submissions.map(s => {
      const e = evalMap.get(s.protocol);
      if (!e) return null;

      const proj = Number(e.proj_total || 0);
      const intr = Number(e.int_total || 0);
      const lang = Number(e.lang_total || 0);

      if (proj < 7 || intr < 7 || lang < 7) return null;

      const projNorm = Math.max(0, Math.min(1, proj / MAX.project));
      const intrNorm = Math.max(0, Math.min(1, intr / MAX.interview));
      const langNorm = Math.max(0, Math.min(1, lang / MAX.language));
      const finalScore = (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);

      const tags = [];
      const info = s.identified || {};
      const combinedCotas = (info.vaga_reservada || info.cotas || '').toLowerCase();
      const combinedInst = (info.vaga_institucional || info.vaga_cooperacao || '').toLowerCase();

      if (combinedCotas.includes('negro') || combinedCotas.includes('preta') || combinedCotas.includes('parda')) tags.push('Negro');
      if (combinedCotas.includes('indigena') || combinedCotas.includes('indígena')) tags.push('Indigena');
      if (combinedCotas.includes('pcd') || combinedCotas.includes('deficiência')) tags.push('PCD');
      if (combinedCotas.includes('trans')) tags.push('Trans');
      if (combinedCotas.includes('quilombola')) tags.push('Quilombola');

      if (combinedInst.includes('uefs') || combinedInst.includes('servidor')) tags.push('Servidor_UEFS');
      if (combinedInst.includes('sdr') || combinedInst.includes('termo')) tags.push('Termo_SDR');

      const linhaRaw = (info.linha_pesquisa || info.area || '').toLowerCase();
      let linha = 0;
      if (linhaRaw.includes('linha 1') || linhaRaw.includes('linha de pesquisa 1')) linha = 1;
      else if (linhaRaw.includes('linha 2') || linhaRaw.includes('linha de pesquisa 2')) linha = 2;

      return {
        nome: info.nome || s.protocol,
        protocol: s.protocol,
        nota: Number(finalScore.toFixed(2)),
        tags: tags,
        linha: linha
      };
    }).filter(c => c !== null);

    const VacancyAllocator = require('../../../vacancy_allocator');
    
    const candidatosL1 = candidatos.filter(c => c.linha === 1);
    const candidatosL2 = candidatos.filter(c => c.linha === 2);
    // Candidatos sem linha definida ou linha desconhecida? Vamos ignorar ou jogar em algum lugar?
    // Por segurança, vamos assumir que todos têm linha. Se não tiver, não entra na alocação.

    const allocator1 = new VacancyAllocator(vagasLinha1, candidatosL1);
    const resultado1 = allocator1.distribuir();

    const allocator2 = new VacancyAllocator(vagasLinha2, candidatosL2);
    const resultado2 = allocator2.distribuir();

    const html = this.adminDashboardPresenter.renderAllocationResult({
      linha1: { resultado: resultado1, total: vagasLinha1, allocator: allocator1 },
      linha2: { resultado: resultado2, total: vagasLinha2, allocator: allocator2 }
    });
    res.type('html').send(html);
  }

  async exportCsv(req, res) {
    const q = String(req.query.q ?? '');
    const status = String(req.query.status ?? '');
    const fromStr = String(req.query.from ?? '');
    const toStr = String(req.query.to ?? '');
    const { from, to } = parseDateRange(fromStr, toStr);

    const activeEditalYear = storage.getActiveEditalYear();
    const yearParam = String(req.query.year ?? '').trim();
    const selectedYear = (() => {
      if (!yearParam) return activeEditalYear;
      const y = Number(yearParam);
      if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y;
      return activeEditalYear;
    })();

    const submissions = await Promise.resolve(this.listSubmissionsUseCase.execute({ q, status, from, to, editalYear: selectedYear }));
    const evals = await Promise.resolve(this.listEvaluationsUseCase.execute());
    const evalMap = new Map(evals.map(e => [e.protocol, e]));

    const WEIGHTS = { project: 4, interview: 5, language: 1 };
    const MAX = { project: 10, interview: 10, language: 10 };

    const header = [
      'Protocolo', 'Data', 'Status', 'CPF (4)', 'Nome', 'Email',
      'Título', 'Área',
      'Nota Projeto', 'Nota Entrevista', 'Nota Língua', 'Nota Final',
      'Qtd Aval Proj', 'Qtd Aval Ent', 'Qtd Aval Ling',
    ].join(';');

    const lines = submissions.map(s => {
      const e = evalMap.get(s.protocol);
      let projTotal = '', intTotal = '', langTotal = '', finalScore = '';
      let projCount = 0, intCount = 0, langCount = 0;

      if (e) {
        const getAny = (key) => {
          if (e[key] != null) return e[key];
          if (e.projectScores && e.projectScores[key] != null) return e.projectScores[key];
          if (e.interviewScores && e.interviewScores[key] != null) return e.interviewScores[key];
          if (e.languageScores && e.languageScores[key] != null) return e.languageScores[key];
          return 0;
        };

        const projPrefixes = ['proj_avaliador1', 'proj_avaliador2', 'proj_avaliador3'];
        const intPrefixes = ['int_avaliador1', 'int_avaliador2', 'int_avaliador3'];
        const langPrefixes = ['lang_avaliador1', 'lang_avaliador2', 'lang_avaliador3'];

        projCount = projPrefixes.reduce((acc, p) => {
          const sum = ['_proj_intro','_proj_problem','_proj_just','_proj_objectives','_proj_review','_proj_methods','_proj_schedule','_proj_refs']
            .reduce((s, suf) => s + (Number(getAny(p + suf)) || 0), 0);
          return acc + (sum > 0 ? 1 : 0);
        }, 0);

        intCount = intPrefixes.reduce((acc, p) => {
          const sum = ['_apresentacao','_historico','_defesa','_justificativa']
            .reduce((s, suf) => s + (Number(getAny(p + suf)) || 0), 0);
          return acc + (sum > 0 ? 1 : 0);
        }, 0);

        langCount = langPrefixes.reduce((acc, p) => {
          const c = Number(getAny(p + '_clareza') || 0);
          const d = Number(getAny(p + '_domino') || 0);
          const a = Number(getAny(p + '_analise') || 0);
          const sum = (c * 0.3) + (d * 0.4) + (a * 0.3);
          return acc + (sum > 0 ? 1 : 0);
        }, 0);

        projTotal = e.proj_total != null ? Number(e.proj_total) : '';
        intTotal = e.int_total != null ? Number(e.int_total) : '';
        langTotal = e.lang_total != null ? Number(e.lang_total) : '';

        const projNorm = projTotal !== '' ? Math.max(0, Math.min(1, Number(projTotal) / MAX.project)) : 0;
        const intNorm = intTotal !== '' ? Math.max(0, Math.min(1, Number(intTotal) / MAX.interview)) : 0;
        const langNorm = langTotal !== '' ? Math.max(0, Math.min(1, Number(langTotal) / MAX.language)) : 0;
        finalScore = (projNorm * WEIGHTS.project) + (intNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
        finalScore = finalScore ? finalScore.toFixed(2) : '';
        projTotal = projTotal !== '' ? Number(projTotal).toFixed(2) : '';
        intTotal = intTotal !== '' ? Number(intTotal).toFixed(2) : '';
        langTotal = langTotal !== '' ? Number(langTotal).toFixed(2) : '';
      }

      const row = [
        s.protocol,
        formatPtBrDateTime(s.createdAt),
        this.listSubmissionsUseCase.normalizeStatus(s.status),
        s.cpfLast4,
        s.identified?.nome || '',
        s.identified?.email || '',
        s.project?.titulo_pt || '',
        s.project?.area || '',
        projTotal,
        intTotal,
        langTotal,
        finalScore,
        String(projCount),
        String(intCount),
        String(langCount),
      ].map(csvEscape);
      return row.join(';');
    });

    const csv = '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n';
    const filename = `inscricoes_${new Date().toISOString().slice(0, 10)}.csv`;

    const ctx = getRequestContext();
    const actorUser = ctx?.actor && typeof ctx.actor === 'object' ? (ctx.actor.user || 'unknown') : 'unknown';
    logDataExport(actorUser, 'csv', submissions.length, ctx?.ip);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  }

  async appeals(req, res) {
    const q = String(req.query.q ?? '');
    const fromStr = String(req.query.from ?? '');
    const toStr = String(req.query.to ?? '');
    const { from, to } = parseDateRange(fromStr, toStr);

    const appeals = await Promise.resolve(this.listAppealsUseCase.execute({ q, from, to }));

    const html = this.adminDashboardPresenter.renderAppeals(appeals, {
      q,
      fromStr,
      toStr,
    });

    res.type('html').send(html);
  }
}

module.exports = AdminController;
