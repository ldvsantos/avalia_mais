const { parseDateRange, csvEscape, formatPtBrDateTime } = require('../../../util');
const storage = require('../../../storage');
const { getRequestContext } = require('../../../request-context');
const { logDataExport } = require('../../../security-logger');

class AdminController {
  constructor(listSubmissionsUseCase, listEvaluationsUseCase, listAppealsUseCase, adminDashboardPresenter, calendarRepo) {
    this.listSubmissionsUseCase = listSubmissionsUseCase;
    this.listEvaluationsUseCase = listEvaluationsUseCase;
    this.listAppealsUseCase = listAppealsUseCase;
    this.adminDashboardPresenter = adminDashboardPresenter;
    this.calendarRepo = calendarRepo;
  }

  dashboard(req, res) {
    const q = String(req.query.q ?? '');
    const status = String(req.query.status ?? '');
    const fromStr = String(req.query.from ?? '');
    const toStr = String(req.query.to ?? '');
    const { from, to } = parseDateRange(fromStr, toStr);

    const submissions = this.listSubmissionsUseCase.execute({ q, status, from, to });
    const evaluations = this.listEvaluationsUseCase.execute();

    const editalYear = new Date().getFullYear();
    const cal = this.calendarRepo.getOrCreateYear(editalYear, { seedRegistrationWindow: storage.getRegistrationWindow() });
    
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
      adminStatusOptions: ['Recebida', 'Em Análise', 'Aprovado', 'Reprovado', 'Indeferido'],
      registrationWindow: window,
      registrationOpen: open,
      editalYear,
    });

    res.type('html').send(html);
  }

  exportCsv(req, res) {
    const q = String(req.query.q ?? '');
    const status = String(req.query.status ?? '');
    const fromStr = String(req.query.from ?? '');
    const toStr = String(req.query.to ?? '');
    const { from, to } = parseDateRange(fromStr, toStr);

    const submissions = this.listSubmissionsUseCase.execute({ q, status, from, to });
    const evals = this.listEvaluationsUseCase.execute();
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

  appeals(req, res) {
    const q = String(req.query.q ?? '');
    const fromStr = String(req.query.from ?? '');
    const toStr = String(req.query.to ?? '');
    const { from, to } = parseDateRange(fromStr, toStr);

    const appeals = this.listAppealsUseCase.execute({ q, from, to });

    const html = this.adminDashboardPresenter.renderAppeals(appeals, {
      q,
      fromStr,
      toStr,
    });

    res.type('html').send(html);
  }
}

module.exports = AdminController;
