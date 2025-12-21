const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
// Suporta `.env` em `server/.env` e também na raiz do projeto.
// Importante: o `.env` de `server/` deve ter prioridade para evitar que
// um `.env` antigo na raiz sobrescreva credenciais atuais em produção.
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const multer = require('multer');

// --- CLEAN ARCHITECTURE IMPORTS ---
const JsonSubmissionRepository = require('./src/infrastructure/repositories/JsonSubmissionRepository');
const SqlSubmissionRepository = require('./src/infrastructure/repositories/SqlSubmissionRepository');
const JsonEvaluatorRepository = require('./src/infrastructure/repositories/JsonEvaluatorRepository');
const JsonEvaluationRepository = require('./src/infrastructure/repositories/JsonEvaluationRepository');
const SqlEvaluationRepository = require('./src/infrastructure/repositories/SqlEvaluationRepository');
const JsonAppealRepository = require('./src/infrastructure/repositories/JsonAppealRepository');
const SqlAppealRepository = require('./src/infrastructure/repositories/SqlAppealRepository');
const JsonProcessCalendarRepository = require('./src/infrastructure/repositories/JsonProcessCalendarRepository');
const JsonCandidatePhaseStatusRepository = require('./src/infrastructure/repositories/JsonCandidatePhaseStatusRepository');
const SqlCandidatePhaseStatusRepository = require('./src/infrastructure/repositories/SqlCandidatePhaseStatusRepository');
const JsonPublicFileRepository = require('./src/infrastructure/repositories/JsonPublicFileRepository');
const JsonEventRepository = require('./src/infrastructure/repositories/JsonEventRepository');
const JsonFaqRepository = require('./src/infrastructure/repositories/JsonFaqRepository');
const { getPgPool } = require('./src/infrastructure/db/postgres');
const JwtService = require('./src/infrastructure/security/JwtService');
const EmailService = require('./src/infrastructure/services/EmailService');
const EmailTemplateService = require('./src/infrastructure/services/EmailTemplateService');
const PdfService = require('./src/infrastructure/services/PdfService');

const RegisterSubmission = require('./src/application/RegisterSubmission');
const RegisterAppeal = require('./src/application/RegisterAppeal');
const AuthenticateUser = require('./src/application/AuthenticateUser');
const SubmitEvaluation = require('./src/application/SubmitEvaluation');

const SubmissionController = require('./src/interfaces/http/controllers/SubmissionController');
const AppealController = require('./src/interfaces/http/controllers/AppealController');
const AuthController = require('./src/interfaces/http/controllers/AuthController');
const EvaluationController = require('./src/interfaces/http/controllers/EvaluationController');
const EventController = require('./src/interfaces/http/controllers/EventController');
const AdminController = require('./src/interfaces/controllers/AdminController');
const AdminDashboardPresenter = require('./src/interfaces/presenters/AdminDashboardPresenter');
const { renderAdminNav } = require('./src/interfaces/presenters/adminNav');
const ListSubmissions = require('./src/application/ListSubmissions');
const ListEvaluations = require('./src/application/ListEvaluations');
const ListAppeals = require('./src/application/ListAppeals');
const { WorkflowService, PHASE, STATUS, APPEAL_STATUS } = require('./src/application/WorkflowService');
// ----------------------------------

// Módulos de segurança
const { generateOrReadAdminSecret } = require('./admin-secret');
const { 
  logSecurityEvent, 
  logLoginSuccess, 
  logLoginFailed, 
  logUnauthorizedAccess,
  logAdminAction 
} = require('./security-logger');
const { 
  detectAttackPatterns, 
  securityHeaders, 
  enforceHTTPS, 
  verifyJWT, 
  validateIPWhitelist,
  getClientIP 
} = require('./security-middleware');

const { requestContextMiddleware, refreshActorFromReq, getRequestContext } = require('./request-context');

const storage = require('./storage');
const {
  stableStringify,
  sha256Hex,
  hmacSha256Hex,
  generateProtocol,
  isValidCPF,
  escapeHtml,
} = require('./util');

const app = express();

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Em produção atrás de Nginx/Load Balancer (AWS), confie em X-Forwarded-* para
// preservar IP real, req.secure e cookies/sessão com HTTPS.
if (IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

// Governança: requestId + contexto de auditoria por requisição
app.use(requestContextMiddleware);

// Normaliza paths com múltiplas barras (ex.: "//secret/..."), comum em links copiados.
// Sem isso, o Express não casa rotas definidas como "/secret/..." e retorna 404.
app.use((req, res, next) => {
  const originalUrl = req.url;
  if (!originalUrl || !originalUrl.includes('//')) return next();

  const qIndex = originalUrl.indexOf('?');
  const pathPart = qIndex >= 0 ? originalUrl.slice(0, qIndex) : originalUrl;
  const queryPart = qIndex >= 0 ? originalUrl.slice(qIndex) : '';
  const normalizedPath = pathPart.replace(/\/{2,}/g, '/');

  if (normalizedPath !== pathPart) {
    req.url = normalizedPath + queryPart;
  }
  return next();
});

// Configuração de Segurança
const ADMIN_SECRET = generateOrReadAdminSecret();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || require('crypto').randomBytes(32).toString('hex');
const ADMIN_IPS = (process.env.ADMIN_IPS || '').split(',').filter(Boolean);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);

// --- CLEAN ARCHITECTURE INITIALIZATION ---
const dataDir = path.join(__dirname, 'data');

const STORAGE_BACKEND = String(process.env.STORAGE_BACKEND || '').trim().toLowerCase();
const ENABLE_POSTGRES = String(process.env.ENABLE_POSTGRES || '').trim().toLowerCase();
const USE_POSTGRES = STORAGE_BACKEND === 'postgres' && (ENABLE_POSTGRES === '1' || ENABLE_POSTGRES === 'true' || ENABLE_POSTGRES === 'yes');

if (STORAGE_BACKEND === 'postgres' && !USE_POSTGRES) {
  console.warn('[storage] STORAGE_BACKEND=postgres definido, mas ENABLE_POSTGRES não está ativo. Mantendo JSON.');
}

const pgPool = USE_POSTGRES ? getPgPool() : null;

const submissionRepo = USE_POSTGRES
  ? new SqlSubmissionRepository({ pool: pgPool })
  : new JsonSubmissionRepository(dataDir);

const evaluatorRepo = new JsonEvaluatorRepository(dataDir);
const evaluationRepo = USE_POSTGRES
  ? new SqlEvaluationRepository({ pool: pgPool })
  : new JsonEvaluationRepository(dataDir);

const appealRepo = USE_POSTGRES
  ? new SqlAppealRepository({ pool: pgPool })
  : new JsonAppealRepository(dataDir);
const calendarRepo = new JsonProcessCalendarRepository(dataDir);
const phaseStatusRepo = USE_POSTGRES
  ? new SqlCandidatePhaseStatusRepository({ pool: pgPool })
  : new JsonCandidatePhaseStatusRepository(dataDir);
const publicFileRepo = new JsonPublicFileRepository(dataDir);
const eventRepo = new JsonEventRepository(dataDir);
const faqRepo = new JsonFaqRepository(dataDir);
const jwtService = new JwtService(JWT_SECRET);
const emailService = new EmailService();
const emailTemplateService = new EmailTemplateService();
const pdfService = new PdfService();

const workflowService = new WorkflowService({
  calendarRepo,
  statusRepo: phaseStatusRepo,
  appealRepo,
  submissionRepo,
  evaluationRepo,
  storageCompat: storage,
});

// Se não configurado, usa SMTP_USER como fallback (útil para receber notificações administrativas sem configuração extra)
const ADMIN_NOTIFY_TO = process.env.ADMIN_NOTIFY_TO || process.env.SMTP_USER || '';

const SITE_URL = String(process.env.SITE_URL || '').trim();

function phaseLabelForEmail(phaseKey) {
  switch (phaseKey) {
    case PHASE.INSCRICAO:
      return 'Inscrição';
    case PHASE.PROJETO:
      return 'Avaliação do Projeto';
    case PHASE.ENTREVISTA:
      return 'Entrevista';
    case PHASE.LINGUA:
      return 'Prova de Língua Estrangeira';
    default:
      return String(phaseKey || 'Etapa');
  }
}

function workflowStatusLabel(status) {
  const st = String(status || '').trim();
  if (st === STATUS.APROVADO) return 'Aprovado(a)';
  if (st === STATUS.REPROVADO_PRELIMINAR) return 'Reprovado(a) preliminarmente';
  if (st === STATUS.REPROVADO_DEFINITIVO) return 'Reprovado(a) definitivamente';
  return st || '—';
}

async function notifyCandidatePhaseResult({ protocol, phaseKey, status, score }) {
  try {
    const submission = submissionRepo && typeof submissionRepo.findByProtocol === 'function'
      ? await Promise.resolve(submissionRepo.findByProtocol(protocol))
      : null;
    const to = String(submission?.identified?.email || '').trim();
    if (!to) return;

    const nome = submission?.identified?.nome || 'Candidato(a)';
    const etapaLabel = phaseLabelForEmail(phaseKey);
    const statusLabel = workflowStatusLabel(status);

    const subject = `Atualização de status (${etapaLabel}) - ${protocol}`;
    const textLines = [
      `Olá ${nome},`,
      '',
      `Protocolo de Inscrição: ${protocol}`,
      `Etapa: ${etapaLabel}`,
      `Status: ${statusLabel}`,
    ];
    if (score != null && Number.isFinite(Number(score))) {
      textLines.push(`Nota: ${Number(score).toFixed(2)}`);
    }
    if (SITE_URL) {
      textLines.push('', `Portal do Candidato: ${SITE_URL.replace(/\/$/, '')}/consulta`);
    }
    const text = textLines.join('\n');

    const html = emailTemplateService && typeof emailTemplateService.getCandidatePhaseResultEmail === 'function'
      ? emailTemplateService.getCandidatePhaseResultEmail({
          nome,
          protocoloInscricao: protocol,
          etapaLabel,
          statusLabel,
          score,
          siteUrl: SITE_URL,
        })
      : undefined;

    await emailService.sendEmail(to, subject, text, html);
  } catch (err) {
    console.error('Falha ao notificar candidato (status de etapa)', err);
  }
}

async function notifyCandidateAppealDecision({ appeal, submission }) {
  try {
    const decision = String(appeal?.status || '').trim();
    if (!decision || decision === APPEAL_STATUS.RECEBIDO) return;

    const to = String(submission?.identified?.email || '').trim();
    if (!to) return;

    const nome = submission?.identified?.nome || 'Candidato(a)';
    const etapaLabel = String(appeal?.etapa || '').trim() || '—';
    const decisionLabel = decision;
    const protocolRecurso = String(appeal?.protocol || '').trim();
    const protocolInscricao = String(appeal?.submissionProtocol || '').trim();

    const subject = `Decisão do recurso (${decisionLabel}) - ${protocolInscricao}`;
    const textLines = [
      `Olá ${nome},`,
      '',
      `Protocolo do Recurso: ${protocolRecurso}`,
      `Protocolo de Inscrição: ${protocolInscricao}`,
      `Etapa: ${etapaLabel}`,
      `Decisão: ${decisionLabel}`,
    ];
    if (SITE_URL) {
      textLines.push('', `Portal do Candidato: ${SITE_URL.replace(/\/$/, '')}/consulta`);
    }
    const text = textLines.join('\n');

    const html = emailTemplateService && typeof emailTemplateService.getCandidateAppealDecisionEmail === 'function'
      ? emailTemplateService.getCandidateAppealDecisionEmail({
          nome,
          protocoloRecurso: protocolRecurso,
          protocoloInscricao: protocolInscricao,
          etapaLabel,
          decisionLabel,
          siteUrl: SITE_URL,
        })
      : undefined;

    await emailService.sendEmail(to, subject, text, html);
  } catch (err) {
    console.error('Falha ao notificar candidato (decisão de recurso)', err);
  }
}

const registerSubmissionUseCase = new RegisterSubmission(
  submissionRepo,
  HMAC_SECRET,
  emailService,
  emailTemplateService,
  pdfService,
  ADMIN_NOTIFY_TO
);
const registerAppealUseCase = new RegisterAppeal(appealRepo, submissionRepo, emailService, emailTemplateService, pdfService, ADMIN_NOTIFY_TO);
const authenticateUserUseCase = new AuthenticateUser(evaluatorRepo, jwtService, { user: ADMIN_USER, pass: ADMIN_PASS });
const submitEvaluationUseCase = new SubmitEvaluation(evaluationRepo, submissionRepo, workflowService);
const listSubmissionsUseCase = new ListSubmissions(submissionRepo);
const listEvaluationsUseCase = new ListEvaluations(evaluationRepo);
const listAppealsUseCase = new ListAppeals(appealRepo);

const adminDashboardPresenter = new AdminDashboardPresenter(ADMIN_SECRET);
const eventController = new EventController(eventRepo);

const submissionController = new SubmissionController(registerSubmissionUseCase, workflowService);
const appealController = new AppealController(registerAppealUseCase, workflowService);
const authController = new AuthController(authenticateUserUseCase, ADMIN_SECRET);
const evaluationController = new EvaluationController(submitEvaluationUseCase);
const adminController = new AdminController(listSubmissionsUseCase, listEvaluationsUseCase, listAppealsUseCase, adminDashboardPresenter, calendarRepo, publicFileRepo);
// -----------------------------------------

// Job de consolidação automática: reprovação definitiva após prazo de recurso
// (simples e resiliente para storage em JSON)
if (require.main === module) {
  setInterval(() => {
    try {
      const year = storage.getActiveEditalYear();
      Promise.resolve(workflowService.reconcileDefinitiveFailures({ year, now: new Date() }))
        .catch((err) => {
          console.error('Workflow job failed', err);
        });
    } catch (err) {
      console.error('Workflow job failed', err);
    }
  }, 5 * 60 * 1000);
}

// 1. Headers de Segurança (Helmet + Custom)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Permite o bundle do html2pdf (carregado via CDN no index.html)
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      // IMPORTANTE: em cenário sem HTTPS (IP/porta 80), isso força o browser a tentar https:// e pode quebrar o carregamento de CSS/JS.
      // Mantemos desabilitado para compatibilidade; habilite HTTPS de verdade antes de reativar.
      'upgrade-insecure-requests': null,
    },
  },
  hsts: IS_PRODUCTION && process.env.ENABLE_HSTS === 'true' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(securityHeaders);

// 2. CORS Restritivo
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (como curl ou apps mobile) ou da whitelist
    if (!origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.length === 0) {
      callback(null, true);
    } else {
      logSecurityEvent('CORS_BLOCKED', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// 3. Detecção de Ataques
app.use(detectAttackPatterns);

// 4. Parsing e Sessão
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

app.use(session({
  secret: JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_PRODUCTION ? 'auto' : false,
    httpOnly: true,
    maxAge: 2 * 60 * 60 * 1000 // 2 horas
  }
}));

// 5. Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip: req.ip, path: req.path });
    res.status(429).json({ error: 'Muitas requisições, tente novamente mais tarde.' });
  }
});
app.use('/api/', apiLimiter);

// Serve the existing static site from /src
app.use('/', express.static(path.join(__dirname, '..', 'src')));

// Também servir imagens em /img (pasta raiz do repo) para assets administrativos (ex.: back_index.jpg)
// Mantém compatibilidade com /src/img: se não existir em /src, cai aqui.
app.use('/img', express.static(path.join(__dirname, '..', 'img')));

// QR Code (para validação via PDF)
app.get('/api/qrcode', async (req, res) => {
  try {
    const data = String(req.query.data || '').trim();
    if (!data) return res.status(400).send('Parâmetro "data" é obrigatório');

    // Limite simples para evitar abuso
    if (data.length > 2048) return res.status(413).send('QR data muito grande');

    res.setHeader('Cache-Control', 'no-store');
    res.type('png');
    return QRCode.toFileStream(res, data, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 220,
    });
  } catch (err) {
    return res.status(500).send('Falha ao gerar QR Code');
  }
});

// Estado do calendário de inscrições (público) — usado também como healthcheck de deploy
app.get('/api/registration-window', (req, res) => {
  try {
    const activeEditalYear = storage.getActiveEditalYear();
    const yearRaw = String(req.query?.year || '').trim();
    const requestedYear = (() => {
      if (!yearRaw) return activeEditalYear;
      const y = Number(yearRaw);
      return Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : activeEditalYear;
    })();

    const cal = calendarRepo.getOrCreateYear(requestedYear, { seedRegistrationWindow: storage.getRegistrationWindow() });
    const window = cal?.phases?.[PHASE.INSCRICAO] || storage.getRegistrationWindow();

    const now = new Date();
    const open = (() => {
      try {
        workflowService.assertCanRegisterSubmission(now);
        return true;
      } catch {
        return false;
      }
    })();

    return res.json({ activeEditalYear, editalYear: requestedYear, registrationWindow: window, open, now: now.toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao obter calendário' });
  }
});

function formatSaoPauloDateBr(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

app.get('/api/public-calendar', (req, res) => {
  try {
    const activeEditalYear = storage.getActiveEditalYear();
    const yearRaw = String(req.query?.year || '').trim();
    const year = yearRaw ? Number(yearRaw) : activeEditalYear;
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Ano inválido' });
    }

    const cal = calendarRepo.getOrCreateYear(year, { seedRegistrationWindow: storage.getRegistrationWindow() });

    const PHASES_FOR_TABLE = [
      { key: 'INSCRICAO', label: 'Inscrições', kind: 'range' },
      { key: 'HOMOLOGACAO_INSCRICOES', label: 'Homologação das inscrições', kind: 'date' },
      { key: 'RECURSO_INSCRICAO', label: 'Recurso (inscrições)', kind: 'range' },
      { key: 'RESULTADO_RECURSO_INSCRICAO', label: 'Resultado do recurso (inscrições)', kind: 'date' },

      { key: 'PROJETO', label: 'Avaliação do anteprojeto', kind: 'range' },
      { key: 'RESULTADO_PROJETO', label: 'Resultado da avaliação do anteprojeto', kind: 'date' },
      { key: 'RECURSO_PROJETO', label: 'Recurso (anteprojeto)', kind: 'range' },
      { key: 'RESULTADO_RECURSO_PROJETO', label: 'Resultado do recurso (anteprojeto)', kind: 'date' },

      { key: 'ENTREVISTA', label: 'Entrevistas', kind: 'range' },
      { key: 'RESULTADO_ENTREVISTA', label: 'Resultado da entrevista', kind: 'date' },
      { key: 'RECURSO_ENTREVISTA', label: 'Recurso (entrevista)', kind: 'range' },
      { key: 'RESULTADO_RECURSO_ENTREVISTA', label: 'Resultado do recurso (entrevista)', kind: 'date' },

      { key: 'LINGUA', label: 'Prova de Língua Estrangeira', kind: 'date' },
      { key: 'RESULTADO_LINGUA', label: 'Resultado da prova de Língua Estrangeira', kind: 'date' },
      { key: 'RECURSO_LINGUA', label: 'Recurso (Língua Estrangeira)', kind: 'range' },
      { key: 'RESULTADO_RECURSO_LINGUA', label: 'Resultado do recurso (Língua Estrangeira)', kind: 'date' },

      { key: 'RESULTADO_FINAL', label: 'Resultado final', kind: 'date' },

      { key: 'HETERO_DOCS_SUBMISSAO', label: 'Heteroidentificação: submissão de documentos', kind: 'range' },
      { key: 'HETERO_PROCEDIMENTO', label: 'Heteroidentificação: procedimento (atividade interna)', kind: 'range' },
      { key: 'HETERO_RESULTADO', label: 'Heteroidentificação: resultado do procedimento', kind: 'date' },
      { key: 'HETERO_RECURSO', label: 'Heteroidentificação: período de recurso', kind: 'range' },
      { key: 'HETERO_BANCA_RECURSAL', label: 'Heteroidentificação: banca recursal (presencial)', kind: 'date' },
      { key: 'HETERO_RESULTADO_FINAL', label: 'Heteroidentificação: resultado final', kind: 'date' },

      { key: 'PRE_MATRICULA_ENVIO', label: 'Pré-matrícula: envio da documentação', kind: 'range' },
      { key: 'INTERNO_ENVIO_DAA', label: 'Envio à DAA (etapa interna)', kind: 'date' },
      { key: 'INTERNO_CADASTRO_MATRICULA', label: 'Cadastro discente e matrícula (etapa interna)', kind: 'range' },
      { key: 'INICIO_SEMESTRE', label: 'Início do semestre', kind: 'date' },
    ];

    const items = PHASES_FOR_TABLE.map(({ key, label, kind }) => {
      const w = cal?.phases?.[key] || null;
      const start = w?.startISO ? formatSaoPauloDateBr(w.startISO) : '';
      const end = w?.endISO ? formatSaoPauloDateBr(w.endISO) : '';

      let display = '';
      if (!start || !end) {
        display = 'A definir';
      } else if (kind === 'date') {
        display = start;
      } else {
        display = start === end ? start : (start + ' a ' + end);
      }

      return { key, label, kind, start, end, display };
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.json({ activeEditalYear, editalYear: year, items, now: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao obter calendário público' });
  }
});

function toSaoPauloDateInput(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';

  // en-CA fornece YYYY-MM-DD. Forçamos o fuso de São Paulo para manter consistência.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function saoPauloDateToWindow(startDateStr, endDateStr) {
  const s = String(startDateStr || '').trim();
  const e = String(endDateStr || '').trim();

  if (!s || !e) {
    throw new Error('Datas obrigatórias');
  }

  // Interpretar como horário de Brasília (UTC-03:00): 00:00 até 23:59.
  // Observação: São Paulo não usa DST atualmente; este offset é suficiente para o edital.
  const start = new Date(`${s}T00:00:00-03:00`);
  const end = new Date(`${e}T23:59:59.999-03:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Formato de data inválido');
  }

  if (start >= end) {
    throw new Error('Janela inválida (início >= fim)');
  }

  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function renderCalendarEditPage({ year, values, saved, error }) {
  const field = (k) => String(values?.[k] || '');

  return `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Admin - Calendário do Edital</title>
      <link rel="stylesheet" href="/theme.css" />
      <link rel="stylesheet" href="/vendor/flatpickr/flatpickr.min.css" />
      <style>
        .hint { color: #003366; font-size: 11px; }
        .success { background:#e6f4ea; border:1px solid #b7e1c1; padding:10px; border-radius:6px; color:#1b5e20; }
        .error { background:#fdecea; border:1px solid #f5c6cb; padding:10px; border-radius:6px; color:#b71c1c; }
        .calendar-macro-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 840px) { .calendar-macro-grid { grid-template-columns: 1fr; } }
        .calendar-macro { background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 10px; }
        .calendar-macro label { display:block; font-weight: 700; margin-bottom: 6px; }
        .calendar-macro input[type="text"] { width: 100%; }
        .calendar-hidden { position:absolute; left:-9999px; top:auto; width:1px; height:1px; overflow:hidden; }
        .color-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }

        /* Destaque visual de fases ocupadas no Flatpickr */
        .flatpickr-day.fp-occupied-inscricoes { background: rgba(46,125,50,0.18); border-color: rgba(46,125,50,0.35); }
        .flatpickr-day.fp-occupied-prova { background: rgba(21,101,192,0.18); border-color: rgba(21,101,192,0.35); }
        .flatpickr-day.fp-occupied-recursos { background: rgba(249,168,37,0.20); border-color: rgba(249,168,37,0.40); }
        .flatpickr-day.fp-occupied-outros { background: rgba(0,0,0,0.08); }
        .flatpickr-day.fp-occupied-multi { background: rgba(183,28,28,0.18); border-color: rgba(183,28,28,0.45); }

        #timeline-container { margin-top: 14px; }
        #timeline-warning { margin-top: 8px; font-weight: 700; display:none; }
        #timeline-warning.show { display:block; }
        .timeline-bar { position: relative; height: 26px; border-radius: 999px; background: rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.12); overflow: hidden; }
        .timeline-bar.conflict { border-color: #b71c1c; background: rgba(183,28,28,0.12); }
        .timeline-seg { position:absolute; top:0; height:100%; border-radius: 999px; }
        .seg-inscricoes { background: #2e7d32; }
        .seg-prova { background: #1565c0; }
        .seg-recursos { background: #f9a825; }
        .seg-projeto { background: #003366; }
        .seg-entrevista { background: #86A3C2; }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <a href="/secret/${ADMIN_SECRET}/admin" aria-label="Voltar ao painel administrativo" style="display:inline-block;">
              <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            </a>
            <h1>Calendário do Edital (Workflow)</h1>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'selection' })}

        <div class="admin-actions" style="justify-content:center; gap:8px; margin-bottom:10px;">
          <span class="admin-badge">Ano: ${escapeHtml(String(year))}</span>
        </div>

        ${saved ? '<div class="success" style="margin-bottom:10px; text-align:center;">Calendário salvo com sucesso.</div>' : ''}
        ${error ? `<div class="error" style="margin-bottom:10px;"><strong>Erro:</strong> ${escapeHtml(error)}</div>` : ''}

        <form id="calendar-form" method="POST" action="/secret/${ADMIN_SECRET}/admin/edital/${encodeURIComponent(String(year))}/calendar/edit">
          <section class="panel">
            <div class="panel-header"><h2>Período Global</h2></div>
            <div class="panel-body">
              <div class="hint">Todas as fases precisam estar dentro do período global.</div>
              <div class="calendar-macro-grid" style="margin-top:10px;">
                <div class="calendar-macro">
                  <label for="GLOBAL_range">Período Global (intervalo)</label>
                  <input id="GLOBAL_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="GLOBAL_start" name="GLOBAL_start" type="hidden" class="calendar-hidden" required value="${escapeHtml(field('GLOBAL_start'))}" />
                  <input id="GLOBAL_end" name="GLOBAL_end" type="hidden" class="calendar-hidden" required value="${escapeHtml(field('GLOBAL_end'))}" />
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Fases (principais)</h2></div>
            <div class="panel-body">
              <div class="hint" id="global-first-hint" style="margin-bottom:10px;">Defina o Período Global para habilitar Inscrições, Projeto, Entrevista, Prova e Recursos.</div>
              <div class="calendar-macro-grid">
                <div class="calendar-macro">
                  <label for="INSCRICAO_range"><span class="color-dot" style="background:#2e7d32"></span> Inscrições (intervalo)</label>
                  <input id="INSCRICAO_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="INSCRICAO_start" name="INSCRICAO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('INSCRICAO_start'))}" />
                  <input id="INSCRICAO_end" name="INSCRICAO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('INSCRICAO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="PROJETO_range"><span class="color-dot" style="background:#003366"></span> Avaliação do Projeto (intervalo)</label>
                  <input id="PROJETO_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="PROJETO_start" name="PROJETO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('PROJETO_start'))}" />
                  <input id="PROJETO_end" name="PROJETO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('PROJETO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="ENTREVISTA_range"><span class="color-dot" style="background:#86A3C2"></span> Entrevista (intervalo)</label>
                  <input id="ENTREVISTA_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="ENTREVISTA_start" name="ENTREVISTA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('ENTREVISTA_start'))}" />
                  <input id="ENTREVISTA_end" name="ENTREVISTA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('ENTREVISTA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="PROVA_date"><span class="color-dot" style="background:#1565c0"></span> Prova de Língua (data única)</label>
                  <input id="PROVA_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="LINGUA_start" name="LINGUA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('LINGUA_start'))}" />
                  <input id="LINGUA_end" name="LINGUA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('LINGUA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RECURSO_INSCRICAO_range"><span class="color-dot" style="background:#f9a825"></span> Recursos de Inscrição</label>
                  <input id="RECURSO_INSCRICAO_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="RECURSO_INSCRICAO_start" name="RECURSO_INSCRICAO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RECURSO_INSCRICAO_start'))}" />
                  <input id="RECURSO_INSCRICAO_end" name="RECURSO_INSCRICAO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RECURSO_INSCRICAO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RECURSO_PROJETO_range"><span class="color-dot" style="background:#f9a825"></span> Recursos de Projeto</label>
                  <input id="RECURSO_PROJETO_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="RECURSO_PROJETO_start" name="RECURSO_PROJETO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RECURSO_PROJETO_start'))}" />
                  <input id="RECURSO_PROJETO_end" name="RECURSO_PROJETO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RECURSO_PROJETO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RECURSO_ENTREVISTA_range"><span class="color-dot" style="background:#f9a825"></span> Recursos de Entrevista</label>
                  <input id="RECURSO_ENTREVISTA_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="RECURSO_ENTREVISTA_start" name="RECURSO_ENTREVISTA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RECURSO_ENTREVISTA_start'))}" />
                  <input id="RECURSO_ENTREVISTA_end" name="RECURSO_ENTREVISTA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RECURSO_ENTREVISTA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RECURSO_LINGUA_range"><span class="color-dot" style="background:#f9a825"></span> Recursos de Prova de Língua</label>
                  <input id="RECURSO_LINGUA_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="RECURSO_LINGUA_start" name="RECURSO_LINGUA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RECURSO_LINGUA_start'))}" />
                  <input id="RECURSO_LINGUA_end" name="RECURSO_LINGUA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RECURSO_LINGUA_end'))}" />
                </div>
              </div>

              <div id="timeline-container">
                <div class="hint" style="margin-bottom:8px;">Timeline (100% = Período Global). Blocos mostram posicionamento e duração das fases principais.</div>
                <div id="timeline-bar" class="timeline-bar" aria-label="Timeline do edital"></div>
                <div id="timeline-warning" class="error">Conflito Detectado</div>
              </div>

              <p class="hint" style="text-align:center; margin-top: 10px;">Datas são interpretadas como horário de Brasília (00:00 até 23:59).</p>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Publicações / Resultados (opcional)</h2></div>
            <div class="panel-body">
              <div class="hint">Use estas datas para registrar publicações/resultado no calendário do edital. Não afeta bloqueios do workflow, mas fica documentado e pode ser consultado/ajustado a qualquer momento.</div>
              <div class="calendar-macro-grid" style="margin-top:10px;">
                <div class="calendar-macro">
                  <label for="HOMOLOGACAO_INSCRICOES_date">Homologação das inscrições (data única)</label>
                  <input id="HOMOLOGACAO_INSCRICOES_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="HOMOLOGACAO_INSCRICOES_start" name="HOMOLOGACAO_INSCRICOES_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HOMOLOGACAO_INSCRICOES_start'))}" />
                  <input id="HOMOLOGACAO_INSCRICOES_end" name="HOMOLOGACAO_INSCRICOES_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HOMOLOGACAO_INSCRICOES_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RESULTADO_RECURSO_INSCRICAO_date">Resultado do recurso (Inscrição) (data única)</label>
                  <input id="RESULTADO_RECURSO_INSCRICAO_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="RESULTADO_RECURSO_INSCRICAO_start" name="RESULTADO_RECURSO_INSCRICAO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_RECURSO_INSCRICAO_start'))}" />
                  <input id="RESULTADO_RECURSO_INSCRICAO_end" name="RESULTADO_RECURSO_INSCRICAO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_RECURSO_INSCRICAO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RESULTADO_PROJETO_date">Resultado da avaliação do projeto (data única)</label>
                  <input id="RESULTADO_PROJETO_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="RESULTADO_PROJETO_start" name="RESULTADO_PROJETO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_PROJETO_start'))}" />
                  <input id="RESULTADO_PROJETO_end" name="RESULTADO_PROJETO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_PROJETO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RESULTADO_RECURSO_PROJETO_date">Resultado do recurso (Projeto) (data única)</label>
                  <input id="RESULTADO_RECURSO_PROJETO_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="RESULTADO_RECURSO_PROJETO_start" name="RESULTADO_RECURSO_PROJETO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_RECURSO_PROJETO_start'))}" />
                  <input id="RESULTADO_RECURSO_PROJETO_end" name="RESULTADO_RECURSO_PROJETO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_RECURSO_PROJETO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RESULTADO_ENTREVISTA_date">Resultado da entrevista (data única)</label>
                  <input id="RESULTADO_ENTREVISTA_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="RESULTADO_ENTREVISTA_start" name="RESULTADO_ENTREVISTA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_ENTREVISTA_start'))}" />
                  <input id="RESULTADO_ENTREVISTA_end" name="RESULTADO_ENTREVISTA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_ENTREVISTA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RESULTADO_RECURSO_ENTREVISTA_date">Resultado do recurso (Entrevista) (data única)</label>
                  <input id="RESULTADO_RECURSO_ENTREVISTA_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="RESULTADO_RECURSO_ENTREVISTA_start" name="RESULTADO_RECURSO_ENTREVISTA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_RECURSO_ENTREVISTA_start'))}" />
                  <input id="RESULTADO_RECURSO_ENTREVISTA_end" name="RESULTADO_RECURSO_ENTREVISTA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_RECURSO_ENTREVISTA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RESULTADO_LINGUA_date">Resultado da prova de língua (data única)</label>
                  <input id="RESULTADO_LINGUA_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="RESULTADO_LINGUA_start" name="RESULTADO_LINGUA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_LINGUA_start'))}" />
                  <input id="RESULTADO_LINGUA_end" name="RESULTADO_LINGUA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_LINGUA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RESULTADO_RECURSO_LINGUA_date">Resultado do recurso (Língua) (data única)</label>
                  <input id="RESULTADO_RECURSO_LINGUA_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="RESULTADO_RECURSO_LINGUA_start" name="RESULTADO_RECURSO_LINGUA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_RECURSO_LINGUA_start'))}" />
                  <input id="RESULTADO_RECURSO_LINGUA_end" name="RESULTADO_RECURSO_LINGUA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_RECURSO_LINGUA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="RESULTADO_FINAL_date">Resultado final (data única)</label>
                  <input id="RESULTADO_FINAL_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="RESULTADO_FINAL_start" name="RESULTADO_FINAL_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_FINAL_start'))}" />
                  <input id="RESULTADO_FINAL_end" name="RESULTADO_FINAL_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('RESULTADO_FINAL_end'))}" />
                </div>
              </div>
              <p class="hint" style="text-align:center; margin-top: 10px;">Obs.: o sistema salva datas por dia (não controla horário, ex.: 17:00).</p>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Heteroidentificação (opcional)</h2></div>
            <div class="panel-body">
              <div class="calendar-macro-grid">
                <div class="calendar-macro">
                  <label for="HETERO_DOCS_SUBMISSAO_range">Submissão de documentos (intervalo)</label>
                  <input id="HETERO_DOCS_SUBMISSAO_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="HETERO_DOCS_SUBMISSAO_start" name="HETERO_DOCS_SUBMISSAO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_DOCS_SUBMISSAO_start'))}" />
                  <input id="HETERO_DOCS_SUBMISSAO_end" name="HETERO_DOCS_SUBMISSAO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_DOCS_SUBMISSAO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="HETERO_PROCEDIMENTO_range">Procedimento (atividade interna) (intervalo)</label>
                  <input id="HETERO_PROCEDIMENTO_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="HETERO_PROCEDIMENTO_start" name="HETERO_PROCEDIMENTO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_PROCEDIMENTO_start'))}" />
                  <input id="HETERO_PROCEDIMENTO_end" name="HETERO_PROCEDIMENTO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_PROCEDIMENTO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="HETERO_RESULTADO_date">Resultado do procedimento (data única)</label>
                  <input id="HETERO_RESULTADO_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="HETERO_RESULTADO_start" name="HETERO_RESULTADO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_RESULTADO_start'))}" />
                  <input id="HETERO_RESULTADO_end" name="HETERO_RESULTADO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_RESULTADO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="HETERO_RECURSO_range">Recurso (intervalo)</label>
                  <input id="HETERO_RECURSO_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="HETERO_RECURSO_start" name="HETERO_RECURSO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_RECURSO_start'))}" />
                  <input id="HETERO_RECURSO_end" name="HETERO_RECURSO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_RECURSO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="HETERO_BANCA_RECURSAL_date">Banca recursal (data única)</label>
                  <input id="HETERO_BANCA_RECURSAL_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="HETERO_BANCA_RECURSAL_start" name="HETERO_BANCA_RECURSAL_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_BANCA_RECURSAL_start'))}" />
                  <input id="HETERO_BANCA_RECURSAL_end" name="HETERO_BANCA_RECURSAL_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_BANCA_RECURSAL_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="HETERO_RESULTADO_FINAL_date">Resultado final (heteroidentificação) (data única)</label>
                  <input id="HETERO_RESULTADO_FINAL_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="HETERO_RESULTADO_FINAL_start" name="HETERO_RESULTADO_FINAL_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_RESULTADO_FINAL_start'))}" />
                  <input id="HETERO_RESULTADO_FINAL_end" name="HETERO_RESULTADO_FINAL_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('HETERO_RESULTADO_FINAL_end'))}" />
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Matrícula / Etapas internas (opcional)</h2></div>
            <div class="panel-body">
              <div class="calendar-macro-grid">
                <div class="calendar-macro">
                  <label for="PRE_MATRICULA_ENVIO_range">Envio de documentação (pré-matrícula) (intervalo)</label>
                  <input id="PRE_MATRICULA_ENVIO_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="PRE_MATRICULA_ENVIO_start" name="PRE_MATRICULA_ENVIO_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('PRE_MATRICULA_ENVIO_start'))}" />
                  <input id="PRE_MATRICULA_ENVIO_end" name="PRE_MATRICULA_ENVIO_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('PRE_MATRICULA_ENVIO_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="INTERNO_ENVIO_DAA_date">Envio para DAA (interno) (data única)</label>
                  <input id="INTERNO_ENVIO_DAA_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="INTERNO_ENVIO_DAA_start" name="INTERNO_ENVIO_DAA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('INTERNO_ENVIO_DAA_start'))}" />
                  <input id="INTERNO_ENVIO_DAA_end" name="INTERNO_ENVIO_DAA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('INTERNO_ENVIO_DAA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="INTERNO_CADASTRO_MATRICULA_range">Cadastro discente e matrícula (interno) (intervalo)</label>
                  <input id="INTERNO_CADASTRO_MATRICULA_range" type="text" placeholder="Selecione um intervalo" autocomplete="off" />
                  <input id="INTERNO_CADASTRO_MATRICULA_start" name="INTERNO_CADASTRO_MATRICULA_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('INTERNO_CADASTRO_MATRICULA_start'))}" />
                  <input id="INTERNO_CADASTRO_MATRICULA_end" name="INTERNO_CADASTRO_MATRICULA_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('INTERNO_CADASTRO_MATRICULA_end'))}" />
                </div>

                <div class="calendar-macro">
                  <label for="INICIO_SEMESTRE_date">Início do semestre (data única)</label>
                  <input id="INICIO_SEMESTRE_date" type="text" placeholder="Selecione uma data" autocomplete="off" />
                  <input id="INICIO_SEMESTRE_start" name="INICIO_SEMESTRE_start" type="hidden" class="calendar-hidden" value="${escapeHtml(field('INICIO_SEMESTRE_start'))}" />
                  <input id="INICIO_SEMESTRE_end" name="INICIO_SEMESTRE_end" type="hidden" class="calendar-hidden" value="${escapeHtml(field('INICIO_SEMESTRE_end'))}" />
                </div>
              </div>
            </div>
          </section>

          <div class="admin-actions" style="justify-content:center; margin: 14px 0 6px;">
            <button class="btn-primary" id="calendar-submit" type="submit">Salvar Calendário</button>
          </div>
        </form>
      </div>

      <script src="/vendor/flatpickr/flatpickr.min.js"></script>
      <script src="/vendor/flatpickr/pt.min.js"></script>
      <script>
        (function () {
          const $ = (id) => document.getElementById(id);

          // Normaliza datas como "meio-dia" local para reduzir problemas de DST/timezone
          // (mantém consistência ao formatar como YYYY-MM-DD e ao somar dias).
          const asLocalNoon = (d) => {
            if (!d) return null;
            return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
          };

          const fmt = (d) => {
            if (!d) return '';
            const x = asLocalNoon(d);
            const y = x.getFullYear();
            const m = String(x.getMonth() + 1).padStart(2, '0');
            const day = String(x.getDate()).padStart(2, '0');
            return String(y) + '-' + m + '-' + day;
          };

          const parseInputDate = (s) => {
            const v = String(s || '').trim();
            if (!v) return null;
            const parts = v.split('-');
            if (parts.length !== 3) return null;
            const y = Number(parts[0]);
            const m = Number(parts[1]);
            const d = Number(parts[2]);
            const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
            return Number.isNaN(dt.getTime()) ? null : dt;
          };

          const addDays = (dt, days) => {
            const x = asLocalNoon(dt);
            x.setDate(x.getDate() + days);
            return x;
          };

          const daysBetween = (start, end) => {
            const a = asLocalNoon(start);
            const b = asLocalNoon(end);
            const ms = b.getTime() - a.getTime();
            return Math.round(ms / 86400000);
          };

          const readRangeFromHidden = (startId, endId) => {
            const start = parseInputDate($(startId)?.value);
            const end = parseInputDate($(endId)?.value);
            return { start, end };
          };

          const setHiddenRange = (startId, endId, start, end) => {
            if ($(startId)) $(startId).value = start ? fmt(start) : '';
            if ($(endId)) $(endId).value = end ? fmt(end) : '';
          };

          const ensureFlatpickr = () => {
            if (!window.flatpickr) throw new Error('Flatpickr não carregou');
          };

          const sameYMD = (a, b) => {
            const x = asLocalNoon(a);
            const y = asLocalNoon(b);
            return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
          };

          const isDateDisabledByRule = (date, rule) => {
            if (!rule) return false;
            if (typeof rule === 'function') return !!rule(date);
            if (rule instanceof Date) return sameYMD(rule, date);

            const t = typeof rule;
            if (t === 'string') {
              const dt = parseInputDate(rule);
              return dt ? sameYMD(dt, date) : false;
            }

            // Suporta { from: Date|string, to: Date|string }
            if (t === 'object' && (rule.from || rule.to)) {
              const from = rule.from instanceof Date ? asLocalNoon(rule.from) : parseInputDate(rule.from);
              const to = rule.to instanceof Date ? asLocalNoon(rule.to) : parseInputDate(rule.to);
              const d = asLocalNoon(date);
              if (from && to) return d >= from && d <= to;
              if (from && !to) return d >= from;
              if (!from && to) return d <= to;
              return false;
            }

            return false;
          };

          const isDateEnabledInFp = (date, fp) => {
            if (!fp) return false;
            const d = asLocalNoon(date);

            const minDate = fp.config && fp.config.minDate instanceof Date ? asLocalNoon(fp.config.minDate) : null;
            const maxDate = fp.config && fp.config.maxDate instanceof Date ? asLocalNoon(fp.config.maxDate) : null;
            if (minDate && d < minDate) return false;
            if (maxDate && d > maxDate) return false;

            const enableRules = Array.isArray(fp.config?.enable) ? fp.config.enable : [];
            if (enableRules.length > 0) {
              // Se há enable[], precisa casar pelo menos um
              const ok = enableRules.some((r) => isDateDisabledByRule(d, r));
              if (!ok) return false;
            }

            const disableRules = Array.isArray(fp.config?.disable) ? fp.config.disable : [];
            if (disableRules.some((r) => isDateDisabledByRule(d, r))) return false;
            return true;
          };

          const rangeIsValid = (start, end, fp, { minNights = 0, maxNights = null } = {}) => {
            if (!start || !end) return false;
            const s = asLocalNoon(start);
            const e = asLocalNoon(end);
            const a = s <= e ? s : e;
            const b = s <= e ? e : s;

            const nights = daysBetween(a, b);
            if (nights < Number(minNights || 0)) return false;
            if (maxNights != null && Number.isFinite(Number(maxNights)) && nights > Number(maxNights)) return false;

            // Não permite intervalos que atravessem dias desabilitados
            for (let cursor = asLocalNoon(a); cursor <= b; cursor = addDays(cursor, 1)) {
              if (!isDateEnabledInFp(cursor, fp)) return false;
            }
            return true;
          };

          const enableDragRange = (fp, { minNights = 0, maxNights = null } = {}) => {
            if (!fp || !fp.calendarContainer) return;

            let dragging = false;
            let dragStart = null;
            let lastHover = null;
            let prevSelection = null;

            const findDayElem = (target) => {
              if (!target) return null;
              const el = target.closest ? target.closest('.flatpickr-day') : null;
              if (!el) return null;
              if (el.classList.contains('prevMonthDay') || el.classList.contains('nextMonthDay')) return null;
              if (!el.dateObj) return null;
              return el;
            };

            const begin = (dayDate, ev) => {
              if (!dayDate) return;
              const d = asLocalNoon(dayDate);
              if (!isDateEnabledInFp(d, fp)) return;

              dragging = true;
              dragStart = d;
              lastHover = d;
              prevSelection = Array.isArray(fp.selectedDates) ? fp.selectedDates.slice() : [];

              // Reinicia o intervalo imediatamente (estilo Airbnb: novo check-in)
              fp.setDate([dragStart, dragStart], false);
              fp.redraw();

              if (ev) {
                ev.preventDefault();
                ev.stopPropagation();
              }
            };

            const move = (dayDate) => {
              if (!dragging || !dragStart || !dayDate) return;
              const d = asLocalNoon(dayDate);
              if (!isDateEnabledInFp(d, fp)) return;
              if (lastHover && sameYMD(lastHover, d)) return;
              lastHover = d;

              if (!rangeIsValid(dragStart, d, fp, { minNights, maxNights })) return;
              fp.setDate([dragStart, d], false);
              fp.redraw();
            };

            const end = (ev) => {
              if (!dragging) return;
              dragging = false;

              const sel = Array.isArray(fp.selectedDates) ? fp.selectedDates.slice() : [];
              if (sel.length === 2 && rangeIsValid(sel[0], sel[1], fp, { minNights, maxNights })) {
                fp.setDate([asLocalNoon(sel[0]), asLocalNoon(sel[1])], true);
                return;
              }

              // Se ficou inválido (ou incompleto), restaura seleção anterior
              if (prevSelection && prevSelection.length > 0) {
                fp.setDate(prevSelection, true);
              } else {
                fp.clear();
              }

              if (ev) {
                ev.preventDefault();
                ev.stopPropagation();
              }
            };

            // Desktop: pointer events
            fp.calendarContainer.addEventListener('pointerdown', (ev) => {
              if (ev.button != null && ev.button !== 0) return;
              const dayEl = findDayElem(ev.target);
              if (!dayEl) return;
              begin(dayEl.dateObj, ev);
            }, { passive: false });

            fp.calendarContainer.addEventListener('pointerenter', (ev) => {
              const dayEl = findDayElem(ev.target);
              if (!dayEl) return;
              move(dayEl.dateObj);
            }, true);

            window.addEventListener('pointerup', end, { passive: false });

            // Mobile/legacy: touch fallback (quando pointer não cobre bem)
            fp.calendarContainer.addEventListener('touchstart', (ev) => {
              const t = ev.touches && ev.touches[0];
              if (!t) return;
              const el = document.elementFromPoint(t.clientX, t.clientY);
              const dayEl = findDayElem(el);
              if (!dayEl) return;
              begin(dayEl.dateObj, ev);
            }, { passive: false });

            fp.calendarContainer.addEventListener('touchmove', (ev) => {
              if (!dragging) return;
              const t = ev.touches && ev.touches[0];
              if (!t) return;
              const el = document.elementFromPoint(t.clientX, t.clientY);
              const dayEl = findDayElem(el);
              if (!dayEl) return;
              move(dayEl.dateObj);
              ev.preventDefault();
            }, { passive: false });

            window.addEventListener('touchend', end, { passive: false });
          };

          const fpCommon = {
            dateFormat: 'Y-m-d',
            altInput: true,
            altFormat: 'd/m/Y',
            showMonths: 2,
            locale: (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.pt) ? window.flatpickr.l10ns.pt : 'pt',
            allowInput: true,
            disableMobile: true,
            clickOpens: true,
          };

          let fpGlobal = null;
          let fpInscricao = null;
          let fpProjeto = null;
          let fpEntrevista = null;
          let fpRecursoInscricao = null;
          let fpRecursoProjeto = null;
          let fpRecursoEntrevista = null;
          let fpRecursoLingua = null;
          let fpProva = null;

          // Etapas opcionais
          let fpHomologInscricoes = null;
          let fpResultadoRecursoInscricao = null;
          let fpResultadoProjeto = null;
          let fpResultadoRecursoProjeto = null;
          let fpResultadoEntrevista = null;
          let fpResultadoRecursoEntrevista = null;
          let fpResultadoLingua = null;
          let fpResultadoRecursoLingua = null;
          let fpResultadoFinal = null;
          let fpHeteroDocs = null;
          let fpHeteroProcedimento = null;
          let fpHeteroResultado = null;
          let fpHeteroRecurso = null;
          let fpHeteroBanca = null;
          let fpHeteroResultadoFinal = null;
          let fpPreMatricula = null;
          let fpInternoDaa = null;
          let fpInternoCadastro = null;
          let fpInicioSemestre = null;

          const setPickerEnabled = (fp, enabled) => {
            if (!fp) return;
            fp.set('clickOpens', !!enabled);
            if (fp.input) fp.input.disabled = !enabled;
            if (fp.altInput) fp.altInput.disabled = !enabled;
          };

          const syncFromPickers = () => {
            const g = fpGlobal?.selectedDates || [];
            if (g.length === 2) setHiddenRange('GLOBAL_start', 'GLOBAL_end', g[0], g[1]);

            const i = fpInscricao?.selectedDates || [];
            if (i.length === 2) setHiddenRange('INSCRICAO_start', 'INSCRICAO_end', i[0], i[1]);

            const pj = fpProjeto?.selectedDates || [];
            if (pj.length === 2) setHiddenRange('PROJETO_start', 'PROJETO_end', pj[0], pj[1]);

            const ev = fpEntrevista?.selectedDates || [];
            if (ev.length === 2) setHiddenRange('ENTREVISTA_start', 'ENTREVISTA_end', ev[0], ev[1]);

            const ri = fpRecursoInscricao?.selectedDates || [];
            if (ri.length === 2) setHiddenRange('RECURSO_INSCRICAO_start', 'RECURSO_INSCRICAO_end', ri[0], ri[1]);

            const rp = fpRecursoProjeto?.selectedDates || [];
            if (rp.length === 2) setHiddenRange('RECURSO_PROJETO_start', 'RECURSO_PROJETO_end', rp[0], rp[1]);

            const re = fpRecursoEntrevista?.selectedDates || [];
            if (re.length === 2) setHiddenRange('RECURSO_ENTREVISTA_start', 'RECURSO_ENTREVISTA_end', re[0], re[1]);

            const rl = fpRecursoLingua?.selectedDates || [];
            if (rl.length === 2) setHiddenRange('RECURSO_LINGUA_start', 'RECURSO_LINGUA_end', rl[0], rl[1]);

            const p = fpProva?.selectedDates || [];
            if (p.length === 1) {
              setHiddenRange('LINGUA_start', 'LINGUA_end', p[0], p[0]);
            }

            const hom = fpHomologInscricoes?.selectedDates || [];
            if (hom.length === 1) setHiddenRange('HOMOLOGACAO_INSCRICOES_start', 'HOMOLOGACAO_INSCRICOES_end', hom[0], hom[0]);

            const rri = fpResultadoRecursoInscricao?.selectedDates || [];
            if (rri.length === 1) setHiddenRange('RESULTADO_RECURSO_INSCRICAO_start', 'RESULTADO_RECURSO_INSCRICAO_end', rri[0], rri[0]);

            const rpj = fpResultadoProjeto?.selectedDates || [];
            if (rpj.length === 1) setHiddenRange('RESULTADO_PROJETO_start', 'RESULTADO_PROJETO_end', rpj[0], rpj[0]);

            const rrpj = fpResultadoRecursoProjeto?.selectedDates || [];
            if (rrpj.length === 1) setHiddenRange('RESULTADO_RECURSO_PROJETO_start', 'RESULTADO_RECURSO_PROJETO_end', rrpj[0], rrpj[0]);

            const rent = fpResultadoEntrevista?.selectedDates || [];
            if (rent.length === 1) setHiddenRange('RESULTADO_ENTREVISTA_start', 'RESULTADO_ENTREVISTA_end', rent[0], rent[0]);

            const rrent = fpResultadoRecursoEntrevista?.selectedDates || [];
            if (rrent.length === 1) setHiddenRange('RESULTADO_RECURSO_ENTREVISTA_start', 'RESULTADO_RECURSO_ENTREVISTA_end', rrent[0], rrent[0]);

            const rlin = fpResultadoLingua?.selectedDates || [];
            if (rlin.length === 1) setHiddenRange('RESULTADO_LINGUA_start', 'RESULTADO_LINGUA_end', rlin[0], rlin[0]);

            const rrlin = fpResultadoRecursoLingua?.selectedDates || [];
            if (rrlin.length === 1) setHiddenRange('RESULTADO_RECURSO_LINGUA_start', 'RESULTADO_RECURSO_LINGUA_end', rrlin[0], rrlin[0]);

            const rf = fpResultadoFinal?.selectedDates || [];
            if (rf.length === 1) setHiddenRange('RESULTADO_FINAL_start', 'RESULTADO_FINAL_end', rf[0], rf[0]);

            const hd = fpHeteroDocs?.selectedDates || [];
            if (hd.length === 2) setHiddenRange('HETERO_DOCS_SUBMISSAO_start', 'HETERO_DOCS_SUBMISSAO_end', hd[0], hd[1]);

            const hp = fpHeteroProcedimento?.selectedDates || [];
            if (hp.length === 2) setHiddenRange('HETERO_PROCEDIMENTO_start', 'HETERO_PROCEDIMENTO_end', hp[0], hp[1]);

            const hr = fpHeteroResultado?.selectedDates || [];
            if (hr.length === 1) setHiddenRange('HETERO_RESULTADO_start', 'HETERO_RESULTADO_end', hr[0], hr[0]);

            const hrec = fpHeteroRecurso?.selectedDates || [];
            if (hrec.length === 2) setHiddenRange('HETERO_RECURSO_start', 'HETERO_RECURSO_end', hrec[0], hrec[1]);

            const hb = fpHeteroBanca?.selectedDates || [];
            if (hb.length === 1) setHiddenRange('HETERO_BANCA_RECURSAL_start', 'HETERO_BANCA_RECURSAL_end', hb[0], hb[0]);

            const hrf = fpHeteroResultadoFinal?.selectedDates || [];
            if (hrf.length === 1) setHiddenRange('HETERO_RESULTADO_FINAL_start', 'HETERO_RESULTADO_FINAL_end', hrf[0], hrf[0]);

            const pm = fpPreMatricula?.selectedDates || [];
            if (pm.length === 2) setHiddenRange('PRE_MATRICULA_ENVIO_start', 'PRE_MATRICULA_ENVIO_end', pm[0], pm[1]);

            const ida = fpInternoDaa?.selectedDates || [];
            if (ida.length === 1) setHiddenRange('INTERNO_ENVIO_DAA_start', 'INTERNO_ENVIO_DAA_end', ida[0], ida[0]);

            const icm = fpInternoCadastro?.selectedDates || [];
            if (icm.length === 2) setHiddenRange('INTERNO_CADASTRO_MATRICULA_start', 'INTERNO_CADASTRO_MATRICULA_end', icm[0], icm[1]);

            const ins = fpInicioSemestre?.selectedDates || [];
            if (ins.length === 1) setHiddenRange('INICIO_SEMESTRE_start', 'INICIO_SEMESTRE_end', ins[0], ins[0]);
          };

          const intervalFromIds = (startId, endId, { singleDay = false } = {}) => {
            const start = parseInputDate($(startId)?.value);
            const end = parseInputDate($(endId)?.value);
            if (!start || !end) return null;
            if (singleDay) {
              return { start, endExcl: addDays(start, 1) };
            }
            // End inclusivo no input (YYYY-MM-DD). Para timeline, tratar como [start, end+1dia).
            return { start, endExcl: addDays(end, 1) };
          };

          const overlap = (a, b) => {
            // intervalos semiabertos [start, endExcl)
            return a.start < b.endExcl && b.start < a.endExcl;
          };

          const sameDate = (a, b) => {
            return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
          };

          const dateInInterval = (date, interval) => {
            if (!date || !interval) return false;
            const d = asLocalNoon(date);
            return interval.start <= d && d < interval.endExcl;
          };

          const getGlobalInterval = () => intervalFromIds('GLOBAL_start', 'GLOBAL_end');

          const PHASE_META = [
            { key: 'INSCRICAO', label: 'Inscrições', startId: 'INSCRICAO_start', endId: 'INSCRICAO_end', singleDay: false },
            { key: 'PROJETO', label: 'Avaliação do Projeto', startId: 'PROJETO_start', endId: 'PROJETO_end', singleDay: false },
            { key: 'ENTREVISTA', label: 'Entrevista', startId: 'ENTREVISTA_start', endId: 'ENTREVISTA_end', singleDay: false },
            { key: 'LINGUA', label: 'Prova', startId: 'LINGUA_start', endId: 'LINGUA_end', singleDay: true },
            { key: 'RECURSO_INSCRICAO', label: 'Recurso Inscrição', startId: 'RECURSO_INSCRICAO_start', endId: 'RECURSO_INSCRICAO_end', singleDay: false },
            { key: 'RECURSO_PROJETO', label: 'Recurso Projeto', startId: 'RECURSO_PROJETO_start', endId: 'RECURSO_PROJETO_end', singleDay: false },
            { key: 'RECURSO_ENTREVISTA', label: 'Recurso Entrevista', startId: 'RECURSO_ENTREVISTA_start', endId: 'RECURSO_ENTREVISTA_end', singleDay: false },
            { key: 'RECURSO_LINGUA', label: 'Recurso Língua', startId: 'RECURSO_LINGUA_start', endId: 'RECURSO_LINGUA_end', singleDay: false },

            // Publicações/Resultados
            { key: 'HOMOLOGACAO_INSCRICOES', label: 'Homologação das inscrições', startId: 'HOMOLOGACAO_INSCRICOES_start', endId: 'HOMOLOGACAO_INSCRICOES_end', singleDay: true },
            { key: 'RESULTADO_RECURSO_INSCRICAO', label: 'Resultado recurso (Inscrição)', startId: 'RESULTADO_RECURSO_INSCRICAO_start', endId: 'RESULTADO_RECURSO_INSCRICAO_end', singleDay: true },
            { key: 'RESULTADO_PROJETO', label: 'Resultado do Projeto', startId: 'RESULTADO_PROJETO_start', endId: 'RESULTADO_PROJETO_end', singleDay: true },
            { key: 'RESULTADO_RECURSO_PROJETO', label: 'Resultado recurso (Projeto)', startId: 'RESULTADO_RECURSO_PROJETO_start', endId: 'RESULTADO_RECURSO_PROJETO_end', singleDay: true },
            { key: 'RESULTADO_ENTREVISTA', label: 'Resultado da Entrevista', startId: 'RESULTADO_ENTREVISTA_start', endId: 'RESULTADO_ENTREVISTA_end', singleDay: true },
            { key: 'RESULTADO_RECURSO_ENTREVISTA', label: 'Resultado recurso (Entrevista)', startId: 'RESULTADO_RECURSO_ENTREVISTA_start', endId: 'RESULTADO_RECURSO_ENTREVISTA_end', singleDay: true },
            { key: 'RESULTADO_LINGUA', label: 'Resultado da Língua', startId: 'RESULTADO_LINGUA_start', endId: 'RESULTADO_LINGUA_end', singleDay: true },
            { key: 'RESULTADO_RECURSO_LINGUA', label: 'Resultado recurso (Língua)', startId: 'RESULTADO_RECURSO_LINGUA_start', endId: 'RESULTADO_RECURSO_LINGUA_end', singleDay: true },
            { key: 'RESULTADO_FINAL', label: 'Resultado Final', startId: 'RESULTADO_FINAL_start', endId: 'RESULTADO_FINAL_end', singleDay: true },

            // Heteroidentificação
            { key: 'HETERO_DOCS_SUBMISSAO', label: 'Hetero: submissão de documentos', startId: 'HETERO_DOCS_SUBMISSAO_start', endId: 'HETERO_DOCS_SUBMISSAO_end', singleDay: false },
            { key: 'HETERO_PROCEDIMENTO', label: 'Hetero: procedimento', startId: 'HETERO_PROCEDIMENTO_start', endId: 'HETERO_PROCEDIMENTO_end', singleDay: false },
            { key: 'HETERO_RESULTADO', label: 'Hetero: resultado', startId: 'HETERO_RESULTADO_start', endId: 'HETERO_RESULTADO_end', singleDay: true },
            { key: 'HETERO_RECURSO', label: 'Hetero: recurso', startId: 'HETERO_RECURSO_start', endId: 'HETERO_RECURSO_end', singleDay: false },
            { key: 'HETERO_BANCA_RECURSAL', label: 'Hetero: banca recursal', startId: 'HETERO_BANCA_RECURSAL_start', endId: 'HETERO_BANCA_RECURSAL_end', singleDay: true },
            { key: 'HETERO_RESULTADO_FINAL', label: 'Hetero: resultado final', startId: 'HETERO_RESULTADO_FINAL_start', endId: 'HETERO_RESULTADO_FINAL_end', singleDay: true },

            // Matrícula / interno
            { key: 'PRE_MATRICULA_ENVIO', label: 'Pré-matrícula: envio de documentos', startId: 'PRE_MATRICULA_ENVIO_start', endId: 'PRE_MATRICULA_ENVIO_end', singleDay: false },
            { key: 'INTERNO_ENVIO_DAA', label: 'Interno: envio para DAA', startId: 'INTERNO_ENVIO_DAA_start', endId: 'INTERNO_ENVIO_DAA_end', singleDay: true },
            { key: 'INTERNO_CADASTRO_MATRICULA', label: 'Interno: cadastro e matrícula', startId: 'INTERNO_CADASTRO_MATRICULA_start', endId: 'INTERNO_CADASTRO_MATRICULA_end', singleDay: false },
            { key: 'INICIO_SEMESTRE', label: 'Início do semestre', startId: 'INICIO_SEMESTRE_start', endId: 'INICIO_SEMESTRE_end', singleDay: true },
          ];

          const getAllIntervals = () => {
            const global = getGlobalInterval();
            const out = { global };
            for (const meta of PHASE_META) {
              out[meta.key] = intervalFromIds(meta.startId, meta.endId, { singleDay: !!meta.singleDay });
            }
            return out;
          };

          const computeConflicts = () => {
            const intervals = getAllIntervals();
            const global = intervals.global;
            const errors = [];
            const warnings = [];

            if (!global) {
              errors.push('Selecione o Período Global.');
              return { errors, warnings, globalMissing: true };
            }

            const phases = [];
            for (const meta of PHASE_META) {
              const itv = intervals[meta.key];
              if (itv) phases.push({ label: meta.label, key: meta.key, ...itv });
            }

            // Contenção no global (Erro: o backend exige isso para salvar)
            for (const ph of phases) {
              if (ph.start < global.start) errors.push(ph.label + ': início fora do Período Global');
              if (ph.endExcl > global.endExcl) errors.push(ph.label + ': fim fora do Período Global');
            }

            // Sobreposição genérica (Aviso: permitido, mas recomendado evitar)
            for (let a = 0; a < phases.length; a++) {
              for (let b = a + 1; b < phases.length; b++) {
                const labelA = phases[a].label;
                const labelB = phases[b].label;
                if (overlap(phases[a], phases[b])) {
                   warnings.push('Sobreposição: ' + labelA + ' x ' + labelB);
                }
              }
            }

            return { errors, warnings, globalMissing: false };
          };

          const buildOnDayCreate = (selfKey) => {
            return (dObj, dStr, fp, dayElem) => {
              // Removemos a lógica visual complexa para evitar confusão ou travamento
            };
          };

          const buildDisableFn = (selfKey, fpInstance) => {
            return (date) => {
              const d = asLocalNoon(date);
              const intervals = getAllIntervals();
              const global = intervals.global;
              if (global && !dateInInterval(d, global)) return true;
              return false;
            };
          };

          const applyConstraints = () => {
            const { global } = getAllIntervals();
            const globalFirstHint = $('global-first-hint');
            const globalDefined = !!global;
            if (globalFirstHint) globalFirstHint.style.display = globalDefined ? 'none' : 'block';

            const globalMin = global ? global.start : null;
            const globalMax = global ? addDays(global.endExcl, -1) : null;

            const setMinMax = (fp) => {
              if (!fp) return;
              fp.set('minDate', globalMin);
              fp.set('maxDate', globalMax);
            };

            const pickers = [
              fpInscricao, fpProjeto, fpEntrevista, fpProva,
              fpRecursoInscricao, fpRecursoProjeto, fpRecursoEntrevista, fpRecursoLingua,
              fpHomologInscricoes, fpResultadoRecursoInscricao, fpResultadoProjeto, fpResultadoRecursoProjeto,
              fpResultadoEntrevista, fpResultadoRecursoEntrevista, fpResultadoLingua, fpResultadoRecursoLingua,
              fpResultadoFinal, fpHeteroDocs, fpHeteroProcedimento, fpHeteroResultado, fpHeteroRecurso, fpHeteroBanca,
              fpHeteroResultadoFinal, fpPreMatricula, fpInternoDaa, fpInternoCadastro, fpInicioSemestre,
            ];

            for (const fp of pickers) {
              setPickerEnabled(fp, globalDefined);
              setMinMax(fp);
              if (fp) fp.redraw();
            }

          };

          const updateTimeline = () => {
            const bar = $('timeline-bar');
            const warn = $('timeline-warning');
            const submit = $('calendar-submit');
            if (!bar || !warn || !submit) return;

            bar.innerHTML = '';
            bar.classList.remove('conflict');
            warn.classList.remove('show');
            warn.textContent = 'Conflito Detectado';
            submit.disabled = false;
            submit.title = '';

            const global = intervalFromIds('GLOBAL_start', 'GLOBAL_end');
            if (!global) {
              bar.classList.add('conflict');
              warn.textContent = 'Conflito Detectado: selecione o Período Global.';
              warn.classList.add('show');
              submit.disabled = true;
              submit.title = 'Defina o Período Global antes de salvar.';
              return;
            }

            const total = global.endExcl.getTime() - global.start.getTime();
            if (!(total > 0)) {
              bar.classList.add('conflict');
              warn.textContent = 'Conflito Detectado: Período Global inválido.';
              warn.classList.add('show');
              submit.disabled = true;
              submit.title = 'Período Global inválido.';
              return;
            }

            const intervals = getAllIntervals();
            const inscr = intervals.INSCRICAO;
            const proj = intervals.PROJETO;
            const ent = intervals.ENTREVISTA;
            const prova = intervals.LINGUA;
            const recInsc = intervals.RECURSO_INSCRICAO;
            const recProj = intervals.RECURSO_PROJETO;
            const recEnt = intervals.RECURSO_ENTREVISTA;
            const recLing = intervals.RECURSO_LINGUA;

            const phases = [];
            if (inscr) phases.push({ key: 'inscricoes', label: 'Inscrições', cls: 'seg-inscricoes', ...inscr });
            if (proj) phases.push({ key: 'projeto', label: 'Avaliação do Projeto', cls: 'seg-projeto', ...proj });
            if (ent) phases.push({ key: 'entrevista', label: 'Entrevista', cls: 'seg-entrevista', ...ent });
            if (prova) phases.push({ key: 'prova', label: 'Prova', cls: 'seg-prova', ...prova });
            if (recInsc) phases.push({ key: 'recursos', label: 'Recurso Inscrição', cls: 'seg-recursos', ...recInsc });
            if (recProj) phases.push({ key: 'recursos', label: 'Recurso Projeto', cls: 'seg-recursos', ...recProj });
            if (recEnt) phases.push({ key: 'recursos', label: 'Recurso Entrevista', cls: 'seg-recursos', ...recEnt });
            if (recLing) phases.push({ key: 'recursos', label: 'Recurso Língua', cls: 'seg-recursos', ...recLing });

            const { errors, warnings } = computeConflicts();

            for (const ph of phases) {
              const offset = ((ph.start.getTime() - global.start.getTime()) / total) * 100;
              const width = ((ph.endExcl.getTime() - ph.start.getTime()) / total) * 100;

              const seg = document.createElement('div');
              seg.className = 'timeline-seg ' + ph.cls;
              seg.style.left = String(Math.max(0, Math.min(100, offset))) + '%';
              seg.style.width = String(Math.max(0.75, Math.min(100, width))) + '%';
              seg.title = ph.label + ': ' + fmt(ph.start) + ' -> ' + fmt(addDays(ph.endExcl, -1));
              bar.appendChild(seg);
            }

            if (errors && errors.length > 0) {
              bar.classList.add('conflict');
              warn.textContent = 'Erro: ' + errors.join(' | ');
              warn.classList.add('show');
              warn.style.color = '#b71c1c';
              submit.disabled = true;
              submit.title = 'Corrija os erros antes de salvar.';
            } else if (warnings && warnings.length > 0) {
              bar.classList.remove('conflict');
              warn.textContent = 'Aviso: ' + warnings.join(' | ');
              warn.classList.add('show');
              warn.style.color = '#e65100'; // Laranja escuro
              submit.disabled = false;
              submit.title = '';
            }
          };

          const bootstrap = () => {
            ensureFlatpickr();

            const g0 = readRangeFromHidden('GLOBAL_start', 'GLOBAL_end');
            const i0 = readRangeFromHidden('INSCRICAO_start', 'INSCRICAO_end');
            const pj0 = readRangeFromHidden('PROJETO_start', 'PROJETO_end');
            const ev0 = readRangeFromHidden('ENTREVISTA_start', 'ENTREVISTA_end');
            const ri0 = readRangeFromHidden('RECURSO_INSCRICAO_start', 'RECURSO_INSCRICAO_end');
            const rp0 = readRangeFromHidden('RECURSO_PROJETO_start', 'RECURSO_PROJETO_end');
            const re0 = readRangeFromHidden('RECURSO_ENTREVISTA_start', 'RECURSO_ENTREVISTA_end');
            const rl0 = readRangeFromHidden('RECURSO_LINGUA_start', 'RECURSO_LINGUA_end');

            const h0 = parseInputDate($('HOMOLOGACAO_INSCRICOES_start')?.value);
            const rri0 = parseInputDate($('RESULTADO_RECURSO_INSCRICAO_start')?.value);
            const rproj0 = parseInputDate($('RESULTADO_PROJETO_start')?.value);
            const rrproj0 = parseInputDate($('RESULTADO_RECURSO_PROJETO_start')?.value);
            const rent0 = parseInputDate($('RESULTADO_ENTREVISTA_start')?.value);
            const rrent0 = parseInputDate($('RESULTADO_RECURSO_ENTREVISTA_start')?.value);
            const rlin0 = parseInputDate($('RESULTADO_LINGUA_start')?.value);
            const rrlin0 = parseInputDate($('RESULTADO_RECURSO_LINGUA_start')?.value);
            const rf0 = parseInputDate($('RESULTADO_FINAL_start')?.value);

            const hd0 = readRangeFromHidden('HETERO_DOCS_SUBMISSAO_start', 'HETERO_DOCS_SUBMISSAO_end');
            const hp0 = readRangeFromHidden('HETERO_PROCEDIMENTO_start', 'HETERO_PROCEDIMENTO_end');
            const hr0 = parseInputDate($('HETERO_RESULTADO_start')?.value);
            const hrec0 = readRangeFromHidden('HETERO_RECURSO_start', 'HETERO_RECURSO_end');
            const hb0 = parseInputDate($('HETERO_BANCA_RECURSAL_start')?.value);
            const hrf0 = parseInputDate($('HETERO_RESULTADO_FINAL_start')?.value);

            const pm0 = readRangeFromHidden('PRE_MATRICULA_ENVIO_start', 'PRE_MATRICULA_ENVIO_end');
            const ida0 = parseInputDate($('INTERNO_ENVIO_DAA_start')?.value);
            const icm0 = readRangeFromHidden('INTERNO_CADASTRO_MATRICULA_start', 'INTERNO_CADASTRO_MATRICULA_end');
            const ins0 = parseInputDate($('INICIO_SEMESTRE_start')?.value);

            const prova0 = parseInputDate($('LINGUA_start')?.value);

            fpGlobal = flatpickr('#GLOBAL_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (g0.start && g0.end) ? [g0.start, g0.end] : null,
              onDayCreate: buildOnDayCreate('GLOBAL'),
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpInscricao = flatpickr('#INSCRICAO_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (i0.start && i0.end) ? [i0.start, i0.end] : null,
              onDayCreate: buildOnDayCreate('INSCRICAO'),
              disable: [],
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpProjeto = flatpickr('#PROJETO_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (pj0.start && pj0.end) ? [pj0.start, pj0.end] : null,
              onDayCreate: buildOnDayCreate('PROJETO'),
              disable: [],
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpEntrevista = flatpickr('#ENTREVISTA_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (ev0.start && ev0.end) ? [ev0.start, ev0.end] : null,
              onDayCreate: buildOnDayCreate('ENTREVISTA'),
              disable: [],
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpRecursoInscricao = flatpickr('#RECURSO_INSCRICAO_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (ri0.start && ri0.end) ? [ri0.start, ri0.end] : null,
              onDayCreate: buildOnDayCreate('RECURSO_INSCRICAO'),
              disable: [],
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpRecursoProjeto = flatpickr('#RECURSO_PROJETO_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (rp0.start && rp0.end) ? [rp0.start, rp0.end] : null,
              onDayCreate: buildOnDayCreate('RECURSO_PROJETO'),
              disable: [],
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpRecursoEntrevista = flatpickr('#RECURSO_ENTREVISTA_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (re0.start && re0.end) ? [re0.start, re0.end] : null,
              onDayCreate: buildOnDayCreate('RECURSO_ENTREVISTA'),
              disable: [],
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpRecursoLingua = flatpickr('#RECURSO_LINGUA_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (rl0.start && rl0.end) ? [rl0.start, rl0.end] : null,
              onDayCreate: buildOnDayCreate('RECURSO_LINGUA'),
              disable: [],
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpProva = flatpickr('#PROVA_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: prova0 || null,
              onDayCreate: buildOnDayCreate('PROVA'),
              disable: [],
              onChange: () => {
                syncFromPickers();
                applyConstraints();
                updateTimeline();
              },
            });

            fpHomologInscricoes = flatpickr('#HOMOLOGACAO_INSCRICOES_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: h0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpResultadoRecursoInscricao = flatpickr('#RESULTADO_RECURSO_INSCRICAO_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: rri0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpResultadoProjeto = flatpickr('#RESULTADO_PROJETO_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: rproj0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpResultadoRecursoProjeto = flatpickr('#RESULTADO_RECURSO_PROJETO_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: rrproj0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpResultadoEntrevista = flatpickr('#RESULTADO_ENTREVISTA_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: rent0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpResultadoRecursoEntrevista = flatpickr('#RESULTADO_RECURSO_ENTREVISTA_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: rrent0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpResultadoLingua = flatpickr('#RESULTADO_LINGUA_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: rlin0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpResultadoRecursoLingua = flatpickr('#RESULTADO_RECURSO_LINGUA_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: rrlin0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpResultadoFinal = flatpickr('#RESULTADO_FINAL_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: rf0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpHeteroDocs = flatpickr('#HETERO_DOCS_SUBMISSAO_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (hd0.start && hd0.end) ? [hd0.start, hd0.end] : null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpHeteroProcedimento = flatpickr('#HETERO_PROCEDIMENTO_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (hp0.start && hp0.end) ? [hp0.start, hp0.end] : null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpHeteroResultado = flatpickr('#HETERO_RESULTADO_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: hr0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpHeteroRecurso = flatpickr('#HETERO_RECURSO_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (hrec0.start && hrec0.end) ? [hrec0.start, hrec0.end] : null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpHeteroBanca = flatpickr('#HETERO_BANCA_RECURSAL_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: hb0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpHeteroResultadoFinal = flatpickr('#HETERO_RESULTADO_FINAL_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: hrf0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpPreMatricula = flatpickr('#PRE_MATRICULA_ENVIO_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (pm0.start && pm0.end) ? [pm0.start, pm0.end] : null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpInternoDaa = flatpickr('#INTERNO_ENVIO_DAA_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: ida0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpInternoCadastro = flatpickr('#INTERNO_CADASTRO_MATRICULA_range', {
              ...fpCommon,
              mode: 'range',
              defaultDate: (icm0.start && icm0.end) ? [icm0.start, icm0.end] : null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            fpInicioSemestre = flatpickr('#INICIO_SEMESTRE_date', {
              ...fpCommon,
              mode: 'single',
              defaultDate: ins0 || null,
              disable: [],
              onChange: () => { syncFromPickers(); applyConstraints(); updateTimeline(); },
            });

            // Disable dinâmico (usa funções, para bloquear fases ocupadas)
            fpInscricao.set('disable', [buildDisableFn('INSCRICAO', fpInscricao)]);
            fpProjeto.set('disable', [buildDisableFn('PROJETO', fpProjeto)]);
            fpEntrevista.set('disable', [buildDisableFn('ENTREVISTA', fpEntrevista)]);
            fpProva.set('disable', [buildDisableFn('PROVA', fpProva)]);
            fpRecursoInscricao.set('disable', [buildDisableFn('RECURSO_INSCRICAO', fpRecursoInscricao)]);
            fpRecursoProjeto.set('disable', [buildDisableFn('RECURSO_PROJETO', fpRecursoProjeto)]);
            fpRecursoEntrevista.set('disable', [buildDisableFn('RECURSO_ENTREVISTA', fpRecursoEntrevista)]);
            fpRecursoLingua.set('disable', [buildDisableFn('RECURSO_LINGUA', fpRecursoLingua)]);

            // Opcionais
            fpHomologInscricoes.set('disable', [buildDisableFn('HOMOLOGACAO_INSCRICOES', fpHomologInscricoes)]);
            fpResultadoRecursoInscricao.set('disable', [buildDisableFn('RESULTADO_RECURSO_INSCRICAO', fpResultadoRecursoInscricao)]);
            fpResultadoProjeto.set('disable', [buildDisableFn('RESULTADO_PROJETO', fpResultadoProjeto)]);
            fpResultadoRecursoProjeto.set('disable', [buildDisableFn('RESULTADO_RECURSO_PROJETO', fpResultadoRecursoProjeto)]);
            fpResultadoEntrevista.set('disable', [buildDisableFn('RESULTADO_ENTREVISTA', fpResultadoEntrevista)]);
            fpResultadoRecursoEntrevista.set('disable', [buildDisableFn('RESULTADO_RECURSO_ENTREVISTA', fpResultadoRecursoEntrevista)]);
            fpResultadoLingua.set('disable', [buildDisableFn('RESULTADO_LINGUA', fpResultadoLingua)]);
            fpResultadoRecursoLingua.set('disable', [buildDisableFn('RESULTADO_RECURSO_LINGUA', fpResultadoRecursoLingua)]);
            fpResultadoFinal.set('disable', [buildDisableFn('RESULTADO_FINAL', fpResultadoFinal)]);
            fpHeteroDocs.set('disable', [buildDisableFn('HETERO_DOCS_SUBMISSAO', fpHeteroDocs)]);
            fpHeteroProcedimento.set('disable', [buildDisableFn('HETERO_PROCEDIMENTO', fpHeteroProcedimento)]);
            fpHeteroResultado.set('disable', [buildDisableFn('HETERO_RESULTADO', fpHeteroResultado)]);
            fpHeteroRecurso.set('disable', [buildDisableFn('HETERO_RECURSO', fpHeteroRecurso)]);
            fpHeteroBanca.set('disable', [buildDisableFn('HETERO_BANCA_RECURSAL', fpHeteroBanca)]);
            fpHeteroResultadoFinal.set('disable', [buildDisableFn('HETERO_RESULTADO_FINAL', fpHeteroResultadoFinal)]);
            fpPreMatricula.set('disable', [buildDisableFn('PRE_MATRICULA_ENVIO', fpPreMatricula)]);
            fpInternoDaa.set('disable', [buildDisableFn('INTERNO_ENVIO_DAA', fpInternoDaa)]);
            fpInternoCadastro.set('disable', [buildDisableFn('INTERNO_CADASTRO_MATRICULA', fpInternoCadastro)]);
            fpInicioSemestre.set('disable', [buildDisableFn('INICIO_SEMESTRE', fpInicioSemestre)]);

            // Garantir sync inicial (útil quando os campos hidden já vieram preenchidos)
            syncFromPickers();
            applyConstraints();
            updateTimeline();
          };

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
              try {
                bootstrap();
              } catch (err) {
                console.error(err);
                alert('Erro ao carregar calendário: ' + err.message);
              }
            });
          } else {
            try {
              bootstrap();
            } catch (err) {
              console.error(err);
              alert('Erro ao carregar calendário: ' + err.message);
            }
          }
        })();
      </script>
    </body>
    </html>
  `;
}

app.get(`/secret/${ADMIN_SECRET}/admin/edital/:year/calendar/edit`, checkAdminIP, adminAuth, (req, res) => {
  try {
    const year = Number(req.params.year);
    const cal = calendarRepo.getOrCreateYear(year, { seedRegistrationWindow: storage.getRegistrationWindow() });
    const saved = String(req.query.saved || '') === '1';

    const values = {
      GLOBAL_start: toSaoPauloDateInput(cal?.global?.startISO),
      GLOBAL_end: toSaoPauloDateInput(cal?.global?.endISO),
      INSCRICAO_start: toSaoPauloDateInput(cal?.phases?.INSCRICAO?.startISO),
      INSCRICAO_end: toSaoPauloDateInput(cal?.phases?.INSCRICAO?.endISO),
      RECURSO_INSCRICAO_start: toSaoPauloDateInput(cal?.phases?.RECURSO_INSCRICAO?.startISO),
      RECURSO_INSCRICAO_end: toSaoPauloDateInput(cal?.phases?.RECURSO_INSCRICAO?.endISO),
      PROJETO_start: toSaoPauloDateInput(cal?.phases?.PROJETO?.startISO),
      PROJETO_end: toSaoPauloDateInput(cal?.phases?.PROJETO?.endISO),
      RECURSO_PROJETO_start: toSaoPauloDateInput(cal?.phases?.RECURSO_PROJETO?.startISO),
      RECURSO_PROJETO_end: toSaoPauloDateInput(cal?.phases?.RECURSO_PROJETO?.endISO),
      ENTREVISTA_start: toSaoPauloDateInput(cal?.phases?.ENTREVISTA?.startISO),
      ENTREVISTA_end: toSaoPauloDateInput(cal?.phases?.ENTREVISTA?.endISO),
      RECURSO_ENTREVISTA_start: toSaoPauloDateInput(cal?.phases?.RECURSO_ENTREVISTA?.startISO),
      RECURSO_ENTREVISTA_end: toSaoPauloDateInput(cal?.phases?.RECURSO_ENTREVISTA?.endISO),
      LINGUA_start: toSaoPauloDateInput(cal?.phases?.LINGUA?.startISO),
      LINGUA_end: toSaoPauloDateInput(cal?.phases?.LINGUA?.endISO),
      RECURSO_LINGUA_start: toSaoPauloDateInput(cal?.phases?.RECURSO_LINGUA?.startISO),
      RECURSO_LINGUA_end: toSaoPauloDateInput(cal?.phases?.RECURSO_LINGUA?.endISO),

      // Opcionais: Publicações / Resultados
      HOMOLOGACAO_INSCRICOES_start: toSaoPauloDateInput(cal?.phases?.HOMOLOGACAO_INSCRICOES?.startISO),
      HOMOLOGACAO_INSCRICOES_end: toSaoPauloDateInput(cal?.phases?.HOMOLOGACAO_INSCRICOES?.endISO),
      RESULTADO_RECURSO_INSCRICAO_start: toSaoPauloDateInput(cal?.phases?.RESULTADO_RECURSO_INSCRICAO?.startISO),
      RESULTADO_RECURSO_INSCRICAO_end: toSaoPauloDateInput(cal?.phases?.RESULTADO_RECURSO_INSCRICAO?.endISO),
      RESULTADO_PROJETO_start: toSaoPauloDateInput(cal?.phases?.RESULTADO_PROJETO?.startISO),
      RESULTADO_PROJETO_end: toSaoPauloDateInput(cal?.phases?.RESULTADO_PROJETO?.endISO),
      RESULTADO_RECURSO_PROJETO_start: toSaoPauloDateInput(cal?.phases?.RESULTADO_RECURSO_PROJETO?.startISO),
      RESULTADO_RECURSO_PROJETO_end: toSaoPauloDateInput(cal?.phases?.RESULTADO_RECURSO_PROJETO?.endISO),
      RESULTADO_ENTREVISTA_start: toSaoPauloDateInput(cal?.phases?.RESULTADO_ENTREVISTA?.startISO),
      RESULTADO_ENTREVISTA_end: toSaoPauloDateInput(cal?.phases?.RESULTADO_ENTREVISTA?.endISO),
      RESULTADO_RECURSO_ENTREVISTA_start: toSaoPauloDateInput(cal?.phases?.RESULTADO_RECURSO_ENTREVISTA?.startISO),
      RESULTADO_RECURSO_ENTREVISTA_end: toSaoPauloDateInput(cal?.phases?.RESULTADO_RECURSO_ENTREVISTA?.endISO),
      RESULTADO_LINGUA_start: toSaoPauloDateInput(cal?.phases?.RESULTADO_LINGUA?.startISO),
      RESULTADO_LINGUA_end: toSaoPauloDateInput(cal?.phases?.RESULTADO_LINGUA?.endISO),
      RESULTADO_RECURSO_LINGUA_start: toSaoPauloDateInput(cal?.phases?.RESULTADO_RECURSO_LINGUA?.startISO),
      RESULTADO_RECURSO_LINGUA_end: toSaoPauloDateInput(cal?.phases?.RESULTADO_RECURSO_LINGUA?.endISO),
      RESULTADO_FINAL_start: toSaoPauloDateInput(cal?.phases?.RESULTADO_FINAL?.startISO),
      RESULTADO_FINAL_end: toSaoPauloDateInput(cal?.phases?.RESULTADO_FINAL?.endISO),

      // Opcionais: Heteroidentificação
      HETERO_DOCS_SUBMISSAO_start: toSaoPauloDateInput(cal?.phases?.HETERO_DOCS_SUBMISSAO?.startISO),
      HETERO_DOCS_SUBMISSAO_end: toSaoPauloDateInput(cal?.phases?.HETERO_DOCS_SUBMISSAO?.endISO),
      HETERO_PROCEDIMENTO_start: toSaoPauloDateInput(cal?.phases?.HETERO_PROCEDIMENTO?.startISO),
      HETERO_PROCEDIMENTO_end: toSaoPauloDateInput(cal?.phases?.HETERO_PROCEDIMENTO?.endISO),
      HETERO_RESULTADO_start: toSaoPauloDateInput(cal?.phases?.HETERO_RESULTADO?.startISO),
      HETERO_RESULTADO_end: toSaoPauloDateInput(cal?.phases?.HETERO_RESULTADO?.endISO),
      HETERO_RECURSO_start: toSaoPauloDateInput(cal?.phases?.HETERO_RECURSO?.startISO),
      HETERO_RECURSO_end: toSaoPauloDateInput(cal?.phases?.HETERO_RECURSO?.endISO),
      HETERO_BANCA_RECURSAL_start: toSaoPauloDateInput(cal?.phases?.HETERO_BANCA_RECURSAL?.startISO),
      HETERO_BANCA_RECURSAL_end: toSaoPauloDateInput(cal?.phases?.HETERO_BANCA_RECURSAL?.endISO),
      HETERO_RESULTADO_FINAL_start: toSaoPauloDateInput(cal?.phases?.HETERO_RESULTADO_FINAL?.startISO),
      HETERO_RESULTADO_FINAL_end: toSaoPauloDateInput(cal?.phases?.HETERO_RESULTADO_FINAL?.endISO),

      // Opcionais: Matrícula / interno
      PRE_MATRICULA_ENVIO_start: toSaoPauloDateInput(cal?.phases?.PRE_MATRICULA_ENVIO?.startISO),
      PRE_MATRICULA_ENVIO_end: toSaoPauloDateInput(cal?.phases?.PRE_MATRICULA_ENVIO?.endISO),
      INTERNO_ENVIO_DAA_start: toSaoPauloDateInput(cal?.phases?.INTERNO_ENVIO_DAA?.startISO),
      INTERNO_ENVIO_DAA_end: toSaoPauloDateInput(cal?.phases?.INTERNO_ENVIO_DAA?.endISO),
      INTERNO_CADASTRO_MATRICULA_start: toSaoPauloDateInput(cal?.phases?.INTERNO_CADASTRO_MATRICULA?.startISO),
      INTERNO_CADASTRO_MATRICULA_end: toSaoPauloDateInput(cal?.phases?.INTERNO_CADASTRO_MATRICULA?.endISO),
      INICIO_SEMESTRE_start: toSaoPauloDateInput(cal?.phases?.INICIO_SEMESTRE?.startISO),
      INICIO_SEMESTRE_end: toSaoPauloDateInput(cal?.phases?.INICIO_SEMESTRE?.endISO),
    };

    res.type('html').send(renderCalendarEditPage({ year, values, saved, error: '' }));
  } catch (err) {
    return res.status(400).send('Falha ao abrir página do calendário: ' + String(err && err.message || err));
  }
});

app.post(`/secret/${ADMIN_SECRET}/admin/edital/:year/calendar/edit`, checkAdminIP, adminAuth, (req, res) => {
  const year = Number(req.params.year);
  try {
    const values = {
      GLOBAL_start: String(req.body?.GLOBAL_start || ''),
      GLOBAL_end: String(req.body?.GLOBAL_end || ''),
      INSCRICAO_start: String(req.body?.INSCRICAO_start || ''),
      INSCRICAO_end: String(req.body?.INSCRICAO_end || ''),
      RECURSO_INSCRICAO_start: String(req.body?.RECURSO_INSCRICAO_start || ''),
      RECURSO_INSCRICAO_end: String(req.body?.RECURSO_INSCRICAO_end || ''),
      PROJETO_start: String(req.body?.PROJETO_start || ''),
      PROJETO_end: String(req.body?.PROJETO_end || ''),
      RECURSO_PROJETO_start: String(req.body?.RECURSO_PROJETO_start || ''),
      RECURSO_PROJETO_end: String(req.body?.RECURSO_PROJETO_end || ''),
      ENTREVISTA_start: String(req.body?.ENTREVISTA_start || ''),
      ENTREVISTA_end: String(req.body?.ENTREVISTA_end || ''),
      RECURSO_ENTREVISTA_start: String(req.body?.RECURSO_ENTREVISTA_start || ''),
      RECURSO_ENTREVISTA_end: String(req.body?.RECURSO_ENTREVISTA_end || ''),
      LINGUA_start: String(req.body?.LINGUA_start || ''),
      LINGUA_end: String(req.body?.LINGUA_end || ''),
      RECURSO_LINGUA_start: String(req.body?.RECURSO_LINGUA_start || ''),
      RECURSO_LINGUA_end: String(req.body?.RECURSO_LINGUA_end || ''),

      HOMOLOGACAO_INSCRICOES_start: String(req.body?.HOMOLOGACAO_INSCRICOES_start || ''),
      HOMOLOGACAO_INSCRICOES_end: String(req.body?.HOMOLOGACAO_INSCRICOES_end || ''),
      RESULTADO_RECURSO_INSCRICAO_start: String(req.body?.RESULTADO_RECURSO_INSCRICAO_start || ''),
      RESULTADO_RECURSO_INSCRICAO_end: String(req.body?.RESULTADO_RECURSO_INSCRICAO_end || ''),
      RESULTADO_PROJETO_start: String(req.body?.RESULTADO_PROJETO_start || ''),
      RESULTADO_PROJETO_end: String(req.body?.RESULTADO_PROJETO_end || ''),
      RESULTADO_RECURSO_PROJETO_start: String(req.body?.RESULTADO_RECURSO_PROJETO_start || ''),
      RESULTADO_RECURSO_PROJETO_end: String(req.body?.RESULTADO_RECURSO_PROJETO_end || ''),
      RESULTADO_ENTREVISTA_start: String(req.body?.RESULTADO_ENTREVISTA_start || ''),
      RESULTADO_ENTREVISTA_end: String(req.body?.RESULTADO_ENTREVISTA_end || ''),
      RESULTADO_RECURSO_ENTREVISTA_start: String(req.body?.RESULTADO_RECURSO_ENTREVISTA_start || ''),
      RESULTADO_RECURSO_ENTREVISTA_end: String(req.body?.RESULTADO_RECURSO_ENTREVISTA_end || ''),
      RESULTADO_LINGUA_start: String(req.body?.RESULTADO_LINGUA_start || ''),
      RESULTADO_LINGUA_end: String(req.body?.RESULTADO_LINGUA_end || ''),
      RESULTADO_RECURSO_LINGUA_start: String(req.body?.RESULTADO_RECURSO_LINGUA_start || ''),
      RESULTADO_RECURSO_LINGUA_end: String(req.body?.RESULTADO_RECURSO_LINGUA_end || ''),
      RESULTADO_FINAL_start: String(req.body?.RESULTADO_FINAL_start || ''),
      RESULTADO_FINAL_end: String(req.body?.RESULTADO_FINAL_end || ''),

      HETERO_DOCS_SUBMISSAO_start: String(req.body?.HETERO_DOCS_SUBMISSAO_start || ''),
      HETERO_DOCS_SUBMISSAO_end: String(req.body?.HETERO_DOCS_SUBMISSAO_end || ''),
      HETERO_PROCEDIMENTO_start: String(req.body?.HETERO_PROCEDIMENTO_start || ''),
      HETERO_PROCEDIMENTO_end: String(req.body?.HETERO_PROCEDIMENTO_end || ''),
      HETERO_RESULTADO_start: String(req.body?.HETERO_RESULTADO_start || ''),
      HETERO_RESULTADO_end: String(req.body?.HETERO_RESULTADO_end || ''),
      HETERO_RECURSO_start: String(req.body?.HETERO_RECURSO_start || ''),
      HETERO_RECURSO_end: String(req.body?.HETERO_RECURSO_end || ''),
      HETERO_BANCA_RECURSAL_start: String(req.body?.HETERO_BANCA_RECURSAL_start || ''),
      HETERO_BANCA_RECURSAL_end: String(req.body?.HETERO_BANCA_RECURSAL_end || ''),
      HETERO_RESULTADO_FINAL_start: String(req.body?.HETERO_RESULTADO_FINAL_start || ''),
      HETERO_RESULTADO_FINAL_end: String(req.body?.HETERO_RESULTADO_FINAL_end || ''),

      PRE_MATRICULA_ENVIO_start: String(req.body?.PRE_MATRICULA_ENVIO_start || ''),
      PRE_MATRICULA_ENVIO_end: String(req.body?.PRE_MATRICULA_ENVIO_end || ''),
      INTERNO_ENVIO_DAA_start: String(req.body?.INTERNO_ENVIO_DAA_start || ''),
      INTERNO_ENVIO_DAA_end: String(req.body?.INTERNO_ENVIO_DAA_end || ''),
      INTERNO_CADASTRO_MATRICULA_start: String(req.body?.INTERNO_CADASTRO_MATRICULA_start || ''),
      INTERNO_CADASTRO_MATRICULA_end: String(req.body?.INTERNO_CADASTRO_MATRICULA_end || ''),
      INICIO_SEMESTRE_start: String(req.body?.INICIO_SEMESTRE_start || ''),
      INICIO_SEMESTRE_end: String(req.body?.INICIO_SEMESTRE_end || ''),
    };

    // Validar período global primeiro
    const global = saoPauloDateToWindow(values.GLOBAL_start, values.GLOBAL_end);
    const globalStart = new Date(global.startISO);
    const globalEnd = new Date(global.endISO);

    // Construir fases e validar contra o período global
    const phases = {};
    const phaseKeys = [
      'INSCRICAO', 'RECURSO_INSCRICAO', 'PROJETO', 'RECURSO_PROJETO',
      'ENTREVISTA', 'RECURSO_ENTREVISTA', 'LINGUA', 'RECURSO_LINGUA',
      'HOMOLOGACAO_INSCRICOES',
      'RESULTADO_RECURSO_INSCRICAO',
      'RESULTADO_PROJETO',
      'RESULTADO_RECURSO_PROJETO',
      'RESULTADO_ENTREVISTA',
      'RESULTADO_RECURSO_ENTREVISTA',
      'RESULTADO_LINGUA',
      'RESULTADO_RECURSO_LINGUA',
      'RESULTADO_FINAL',
      'HETERO_DOCS_SUBMISSAO',
      'HETERO_PROCEDIMENTO',
      'HETERO_RESULTADO',
      'HETERO_RECURSO',
      'HETERO_BANCA_RECURSAL',
      'HETERO_RESULTADO_FINAL',
      'PRE_MATRICULA_ENVIO',
      'INTERNO_ENVIO_DAA',
      'INTERNO_CADASTRO_MATRICULA',
      'INICIO_SEMESTRE'
    ];

    for (const key of phaseKeys) {
      const startVal = values[`${key}_start`];
      const endVal = values[`${key}_end`];
      
      if (startVal && endVal) {
        const phaseWindow = saoPauloDateToWindow(startVal, endVal);
        const phaseStart = new Date(phaseWindow.startISO);
        const phaseEnd = new Date(phaseWindow.endISO);

        // Validar que a fase está dentro do período global
        if (phaseStart < globalStart) {
          throw new Error(`${key}: data de início (${startVal}) é anterior ao início global (${values.GLOBAL_start})`);
        }
        if (phaseEnd > globalEnd) {
          throw new Error(`${key}: data de fim (${endVal}) é posterior ao fim global (${values.GLOBAL_end})`);
        }

        phases[key] = phaseWindow;
      }
    }

    const calendar = { global, phases };

    calendarRepo.setYearCalendar(year, calendar);
    return res.redirect(`/secret/${ADMIN_SECRET}/admin/edital/${encodeURIComponent(String(year))}/calendar/edit?saved=1`);
  } catch (err) {
    const values = {
      GLOBAL_start: String(req.body?.GLOBAL_start || ''),
      GLOBAL_end: String(req.body?.GLOBAL_end || ''),
      INSCRICAO_start: String(req.body?.INSCRICAO_start || ''),
      INSCRICAO_end: String(req.body?.INSCRICAO_end || ''),
      RECURSO_INSCRICAO_start: String(req.body?.RECURSO_INSCRICAO_start || ''),
      RECURSO_INSCRICAO_end: String(req.body?.RECURSO_INSCRICAO_end || ''),
      PROJETO_start: String(req.body?.PROJETO_start || ''),
      PROJETO_end: String(req.body?.PROJETO_end || ''),
      RECURSO_PROJETO_start: String(req.body?.RECURSO_PROJETO_start || ''),
      RECURSO_PROJETO_end: String(req.body?.RECURSO_PROJETO_end || ''),
      ENTREVISTA_start: String(req.body?.ENTREVISTA_start || ''),
      ENTREVISTA_end: String(req.body?.ENTREVISTA_end || ''),
      RECURSO_ENTREVISTA_start: String(req.body?.RECURSO_ENTREVISTA_start || ''),
      RECURSO_ENTREVISTA_end: String(req.body?.RECURSO_ENTREVISTA_end || ''),
      LINGUA_start: String(req.body?.LINGUA_start || ''),
      LINGUA_end: String(req.body?.LINGUA_end || ''),
      RECURSO_LINGUA_start: String(req.body?.RECURSO_LINGUA_start || ''),
      RECURSO_LINGUA_end: String(req.body?.RECURSO_LINGUA_end || ''),

      HOMOLOGACAO_INSCRICOES_start: String(req.body?.HOMOLOGACAO_INSCRICOES_start || ''),
      HOMOLOGACAO_INSCRICOES_end: String(req.body?.HOMOLOGACAO_INSCRICOES_end || ''),
      RESULTADO_RECURSO_INSCRICAO_start: String(req.body?.RESULTADO_RECURSO_INSCRICAO_start || ''),
      RESULTADO_RECURSO_INSCRICAO_end: String(req.body?.RESULTADO_RECURSO_INSCRICAO_end || ''),
      RESULTADO_PROJETO_start: String(req.body?.RESULTADO_PROJETO_start || ''),
      RESULTADO_PROJETO_end: String(req.body?.RESULTADO_PROJETO_end || ''),
      RESULTADO_RECURSO_PROJETO_start: String(req.body?.RESULTADO_RECURSO_PROJETO_start || ''),
      RESULTADO_RECURSO_PROJETO_end: String(req.body?.RESULTADO_RECURSO_PROJETO_end || ''),
      RESULTADO_ENTREVISTA_start: String(req.body?.RESULTADO_ENTREVISTA_start || ''),
      RESULTADO_ENTREVISTA_end: String(req.body?.RESULTADO_ENTREVISTA_end || ''),
      RESULTADO_RECURSO_ENTREVISTA_start: String(req.body?.RESULTADO_RECURSO_ENTREVISTA_start || ''),
      RESULTADO_RECURSO_ENTREVISTA_end: String(req.body?.RESULTADO_RECURSO_ENTREVISTA_end || ''),
      RESULTADO_LINGUA_start: String(req.body?.RESULTADO_LINGUA_start || ''),
      RESULTADO_LINGUA_end: String(req.body?.RESULTADO_LINGUA_end || ''),
      RESULTADO_RECURSO_LINGUA_start: String(req.body?.RESULTADO_RECURSO_LINGUA_start || ''),
      RESULTADO_RECURSO_LINGUA_end: String(req.body?.RESULTADO_RECURSO_LINGUA_end || ''),
      RESULTADO_FINAL_start: String(req.body?.RESULTADO_FINAL_start || ''),
      RESULTADO_FINAL_end: String(req.body?.RESULTADO_FINAL_end || ''),

      HETERO_DOCS_SUBMISSAO_start: String(req.body?.HETERO_DOCS_SUBMISSAO_start || ''),
      HETERO_DOCS_SUBMISSAO_end: String(req.body?.HETERO_DOCS_SUBMISSAO_end || ''),
      HETERO_PROCEDIMENTO_start: String(req.body?.HETERO_PROCEDIMENTO_start || ''),
      HETERO_PROCEDIMENTO_end: String(req.body?.HETERO_PROCEDIMENTO_end || ''),
      HETERO_RESULTADO_start: String(req.body?.HETERO_RESULTADO_start || ''),
      HETERO_RESULTADO_end: String(req.body?.HETERO_RESULTADO_end || ''),
      HETERO_RECURSO_start: String(req.body?.HETERO_RECURSO_start || ''),
      HETERO_RECURSO_end: String(req.body?.HETERO_RECURSO_end || ''),
      HETERO_BANCA_RECURSAL_start: String(req.body?.HETERO_BANCA_RECURSAL_start || ''),
      HETERO_BANCA_RECURSAL_end: String(req.body?.HETERO_BANCA_RECURSAL_end || ''),
      HETERO_RESULTADO_FINAL_start: String(req.body?.HETERO_RESULTADO_FINAL_start || ''),
      HETERO_RESULTADO_FINAL_end: String(req.body?.HETERO_RESULTADO_FINAL_end || ''),

      PRE_MATRICULA_ENVIO_start: String(req.body?.PRE_MATRICULA_ENVIO_start || ''),
      PRE_MATRICULA_ENVIO_end: String(req.body?.PRE_MATRICULA_ENVIO_end || ''),
      INTERNO_ENVIO_DAA_start: String(req.body?.INTERNO_ENVIO_DAA_start || ''),
      INTERNO_ENVIO_DAA_end: String(req.body?.INTERNO_ENVIO_DAA_end || ''),
      INTERNO_CADASTRO_MATRICULA_start: String(req.body?.INTERNO_CADASTRO_MATRICULA_start || ''),
      INTERNO_CADASTRO_MATRICULA_end: String(req.body?.INTERNO_CADASTRO_MATRICULA_end || ''),
      INICIO_SEMESTRE_start: String(req.body?.INICIO_SEMESTRE_start || ''),
      INICIO_SEMESTRE_end: String(req.body?.INICIO_SEMESTRE_end || ''),
    };
    res.status(400).type('html').send(renderCalendarEditPage({
      year,
      values,
      saved: false,
      error: String(err && err.message || err),
    }));
  }
});

// Admin: decisão/atualização de status do recurso (para workflow)
app.post(`/secret/${ADMIN_SECRET}/admin/appeals/:protocol/status`, checkAdminIP, adminAuth, async (req, res) => {
  try {
    const protocol = String(req.params.protocol || '').trim();
    if (!protocol) return res.status(400).json({ error: 'Protocolo inválido' });

    const status = String(req.body?.status || '').trim();
    const allowed = [APPEAL_STATUS.RECEBIDO, APPEAL_STATUS.DEFERIDO, APPEAL_STATUS.INDEFERIDO];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Status inválido. Use Recebido, Deferido ou Indeferido.' });
    }

    const updated = typeof appealRepo.updateStatus === 'function'
      ? await Promise.resolve(appealRepo.updateStatus(protocol, status))
      : null;

    if (!updated) return res.status(404).json({ error: 'Recurso não encontrado' });

    // Notifica candidato (se aplicável)
    try {
      if (updated && updated.submissionProtocol) {
        const submission = submissionRepo && typeof submissionRepo.findByProtocol === 'function'
          ? await Promise.resolve(submissionRepo.findByProtocol(updated.submissionProtocol))
          : null;
        if (submission) {
          // Decisão Deferido/Indeferido
          await notifyCandidateAppealDecision({ appeal: updated, submission });
        }
      }
    } catch {
      // não bloqueia
    }

    // tenta reconciliar imediatamente após decisão
    const year = new Date().getFullYear();
    Promise.resolve(workflowService.reconcileDefinitiveFailures({ year, now: new Date() }))
      .catch(() => {
        // não bloqueia
      });

    return res.json({ ok: true, appeal: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

function checkAdminIP(req, res, next) {
  const clientIP = getClientIP(req);
  
  if (ADMIN_IPS.length > 0 && !ADMIN_IPS.includes(clientIP)) {
    logUnauthorizedAccess(req.path, clientIP, req.method, { reason: 'IP_NOT_WHITELISTED' });
    return res.status(403).send('Acesso não autorizado (IP)');
  }
  next();
}

function adminAuth(req, res, next) {
  // Verificar token na sessão ou header
  const token = req.session.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  
  if (!token) {
    // Se for requisição AJAX/API, retornar JSON
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(401).json({ error: 'Autenticação necessária' });
    }
    // Se for navegador, redirecionar para login
    return res.redirect(`/secret/${ADMIN_SECRET}/`);
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    // Atualiza o contexto (ator) após autenticação
    refreshActorFromReq(req);
    next();
  } catch (err) {
    logLoginFailed('unknown', req.ip, 'INVALID_TOKEN');
    // Limpar sessão inválida
    if (req.session) req.session.destroy();
    
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
      return res.status(401).json({ error: 'Sessão expirada ou inválida' });
    }
    return res.redirect(`/secret/${ADMIN_SECRET}/`);
  }
}

function pickSubmissionPayload(body) {
  const limitText = (value, maxLen) => {
    const s = String(value ?? '');
    return s.length > maxLen ? s.slice(0, maxLen) : s;
  };

  const identified = {
    nome: body?.nome || '',
    nome_social: body?.nome_social || '',
    data_nascimento: body?.data_nascimento || '',
    cpf: body?.cpf || '',
    rg: body?.rg || '',
    orgao_expedidor: body?.orgao_expedidor || '',
    data_expedicao: body?.data_expedicao || '',
    endereco: body?.endereco || '',
    cidade_estado: body?.cidade_estado || '',
    cep: body?.cep || '',
    celular: body?.celular || '',
    telefone_residencial: body?.telefone_residencial || '',
    email: body?.email || '',
    curso_graduacao: body?.curso_graduacao || '',
    instituicao: body?.instituicao || '',
    ano_conclusao: body?.ano_conclusao || '',
    vaga_institucional: body?.vaga_institucional || '',
    vaga_cooperacao: body?.vaga_cooperacao || '',
    vaga_reservada: body?.vaga_reservada || '',
    cotas: body?.cotas || '',
    raca_cor: body?.raca_cor || '',
    lingua_estrangeira: body?.lingua_estrangeira || '',
    vinculo_empregaticio: body?.vinculo_empregaticio || '',
    carga_horaria: body?.carga_horaria || '',
    empresa_vinculo: body?.empresa_vinculo || '',
    termo_compromisso: body?.termo_compromisso || '',
  };

  const project = {
    titulo_pt: body?.titulo_pt || '',
    titulo_en: body?.titulo_en || '',
    area: body?.area || '',
    palavras_pt: body?.palavras_pt || '',
    palavras_en: body?.palavras_en || '',
    resumo: limitText(body?.resumo || '', 1800),
    // Campos ANEXO IV (sem identificação)
    justificativa_enquadramento: body?.justificativa_enquadramento || '',
    introducao: body?.introducao || '',
    problema_pesquisa: body?.problema_pesquisa || '',
    justificativa_relevancia: body?.justificativa_relevancia || '',
    objetivo_geral: limitText(body?.objetivo_geral || '', 200),
    objetivos_especificos: body?.objetivos_especificos || '',
    objetivos_geral_especificos: body?.objetivos_geral_especificos || '',
    revisao_literatura: body?.revisao_literatura || '',
    procedimentos_metodologicos: body?.procedimentos_metodologicos || '',
    cronograma: body?.cronograma || '',
    referencias: body?.referencias || '',

    // Campos antigos (mantidos para compatibilidade com registros anteriores)
    objetivos: body?.objetivos || '',
    metas: body?.metas || '',
    metodologia: body?.metodologia || '',
    relevancia: body?.relevancia || '',
    colaboradoras: body?.colaboradoras || '',
    resultados: body?.resultados || '',
    potencial: body?.potencial || '',
  };

  return { identified, project };
}

const ADMIN_STATUS_OPTIONS = ['Recebida', 'Em análise', 'Em recurso', 'Aprovada', 'Indeferida'];

function normalizeStatus(input) {
  const raw = String(input ?? '').trim();
  if (ADMIN_STATUS_OPTIONS.includes(raw)) return raw;
  return 'Recebida';
}

function toLower(s) {
  return String(s ?? '').toLowerCase();
}

function parseDateRange(fromStr, toStr) {
  const fromRaw = String(fromStr ?? '').trim();
  const toRaw = String(toStr ?? '').trim();

  const from = fromRaw ? new Date(fromRaw + 'T00:00:00') : null;
  const to = toRaw ? new Date(toRaw + 'T23:59:59.999') : null;
  const fromOk = from && !Number.isNaN(from.getTime()) ? from : null;
  const toOk = to && !Number.isNaN(to.getTime()) ? to : null;
  return { from: fromOk, to: toOk };
}

function filterSubmissions(submissions, { q, status, from, to }) {
  const qNorm = String(q ?? '').trim().toLowerCase();
  const statusNorm = String(status ?? '').trim();

  return submissions.filter(s => {
    const sStatus = normalizeStatus(s.status);

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
    ].map(toLower).join(' | ');

    return hay.includes(qNorm);
  });
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[";\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function formatPtBrDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return String(iso ?? '');
  }
}

app.post('/api/submissions', (req, res) => submissionController.register(req, res));

app.post('/api/appeals', (req, res) => appealController.register(req, res));

// Etapas de recurso em prazo (público; baseado no calendário do edital)
app.get('/api/public/open-appeal-etapas', (req, res) => {
  try {
    const now = new Date();
    const yearRaw = String(req.query?.year || '').trim();
    const year = yearRaw ? Number(yearRaw) : now.getFullYear();

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: 'Ano inválido' });
    }

    const cal = workflowService.getCalendar(year);
    const phases = cal?.phases || {};

    const withinWindow = (window) => {
      try {
        const start = window?.startISO ? new Date(window.startISO) : null;
        const end = window?.endISO ? new Date(window.endISO) : null;
        if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        return now >= start && now <= end;
      } catch {
        return false;
      }
    };

    const etapaMap = [
      { etapa: 'Inscrição', appealPhase: PHASE.RECURSO_INSCRICAO },
      { etapa: 'Avaliação do Projeto', appealPhase: PHASE.RECURSO_PROJETO },
      { etapa: 'Entrevista', appealPhase: PHASE.RECURSO_ENTREVISTA },
      { etapa: 'Prova de Língua Estrangeira', appealPhase: PHASE.RECURSO_LINGUA },
    ];

    const etapas = etapaMap
      .filter((x) => withinWindow(phases?.[x.appealPhase]))
      .map((x) => x.etapa);

    return res.json({ year, nowISO: now.toISOString(), etapas });
  } catch (err) {
    console.error('Falha ao calcular etapas de recurso em prazo', err);
    return res.status(500).json({ error: 'Falha ao calcular etapas em prazo' });
  }
});

// Download do comprovante (PDF) do recurso
app.get('/api/appeals/:protocol/pdf', async (req, res) => {
  try {
    const protocol = String(req.params.protocol || '').trim();
    if (!protocol) return res.status(400).json({ error: 'Protocolo inválido' });

    const appeal = await Promise.resolve(appealRepo.findByProtocol(protocol));
    if (!appeal) return res.status(404).json({ error: 'Recurso não encontrado' });

    const pdfBuffer = await pdfService.generateAppealPdf(appeal);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="recurso-${protocol}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Falha ao gerar PDF do recurso', err);
    return res.status(500).json({ error: 'Falha ao gerar PDF do recurso' });
  }
});

// Listar recursos vinculados a uma inscrição (público; depende do protocolo)
app.get('/api/submissions/:protocol/appeals', async (req, res) => {
  try {
    const protocol = String(req.params.protocol || '').trim();
    if (!protocol) return res.status(400).json({ error: 'Protocolo inválido' });

    const record = await Promise.resolve(submissionRepo.findByProtocol(protocol));
    if (!record) return res.status(404).json({ error: 'Não encontrado' });

    const appeals = typeof appealRepo.findBySubmissionProtocol === 'function'
      ? await Promise.resolve(appealRepo.findBySubmissionProtocol(protocol))
      : [];
    const safe = (appeals || []).map((a) => ({
      protocol: a?.protocol,
      createdAt: a?.createdAt,
      etapa: a?.etapa,
      status: a?.status,
    }));

    return res.json({ submissionProtocol: protocol, appeals: safe });
  } catch (err) {
    console.error('Falha ao listar recursos da inscrição', err);
    return res.status(500).json({ error: 'Falha ao listar recursos' });
  }
});

// --- PUBLIC FILES / RESULTS ---
function isLikelyPdf(buffer) {
  try {
    if (!buffer || buffer.length < 4) return false;
    return buffer.slice(0, 4).toString('utf8') === '%PDF';
  } catch {
    return false;
  }
}

const publicStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', 'src', 'results');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});
const uploadPublic = multer({ storage: publicStorage });

const eventImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '..', 'img', 'events');
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + safeName + ext);
  }
});
const uploadEventImage = multer({ 
  storage: eventImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas'));
    }
  }
});

app.get('/api/public-files', (req, res) => {
  const files = publicFileRepo.getAll();
  files.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(files);
});

// FAQ público (Ajuda e Perguntas Frequentes)
app.get('/api/public-faq', (req, res) => {
  const faq = faqRepo.get();
  return res.json(faq);
});

// Lista pública de eventos/cursos abertos (para a página de cursos)
app.get('/api/public-events', async (req, res) => {
  try {
    const events = await eventRepo.findAll();
    const safe = (events || [])
      .filter((e) => e && e.status === 'open')
      .map((e) => ({
        id: String(e.id || ''),
        title: String(e.title || ''),
        date: e.date || null,
        location: String(e.location || ''),
        workload: String(e.workload || ''),
        description: String(e.description || ''),
        speakers: String(e.speakers || ''),
        imageUrl: e.imageFilename ? '/img/events/' + e.imageFilename : null,
      }))
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
      });

    return res.json(safe);
  } catch (err) {
    console.error('Falha ao listar eventos públicos', err);
    return res.status(500).json({ error: 'Falha ao listar eventos' });
  }
});

app.post(`/secret/${ADMIN_SECRET}/admin/public-files`, checkAdminIP, adminAuth, uploadPublic.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).send('Nenhum arquivo enviado');

    const originalName = String(req.file.originalname || '').trim();
    const extOk = originalName.toLowerCase().endsWith('.pdf');
    if (!extOk) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).send('Arquivo inválido: envie apenas PDF');
    }

    const uploadedBuffer = fs.readFileSync(req.file.path);
    if (!isLikelyPdf(uploadedBuffer)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).send('Arquivo inválido: PDF corrompido ou formato não suportado');
    }

    // Carimbo visual (para ficar óbvio no navegador) + hash do conteúdo original.
    // Obs: o hash do arquivo assinado (bytes finais) é diferente porque a assinatura altera o PDF.
    const contentHash = sha256Hex(uploadedBuffer);
    const stampedBuffer = await pdfService.stampUploadedPdf(uploadedBuffer, {
      createdAt: new Date().toISOString(),
      hash: contentHash,
    });

    // Assina o PDF (mesmo se não foi gerado pelo sistema) para garantir proveniência.
    let signedBuffer;
    try {
      signedBuffer = await pdfService.signPdf(stampedBuffer, { requireSignature: true });
    } catch (err) {
      console.error('Falha ao assinar PDF enviado pelo admin', err);
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(500).send('Não foi possível assinar este PDF. Tente exportar/"imprimir" novamente (ou envie outro PDF).');
    }

    // Escreve de forma segura (arquivo temporário + rename)
    const tmpPath = req.file.path + '.tmp';
    fs.writeFileSync(tmpPath, signedBuffer);
    fs.renameSync(tmpPath, req.file.path);

    const title = req.body.title || req.file.originalname;

    const ctx = getRequestContext();
    const signedBy = ctx?.actor?.user || (req.user && (req.user.user || req.user.username)) || 'admin';
    const signedIp = ctx?.ip || getClientIP(req);
    const signedHash = sha256Hex(signedBuffer);

    const fileData = {
      id: Date.now().toString(),
      title,
      filename: req.file.filename,
      date: new Date().toISOString(),
      hash: contentHash,
      signedFileHash: signedHash,
      signedAt: new Date().toISOString(),
      signedBy,
      signedIp,
    };
    publicFileRepo.add(fileData);

    logAdminAction('PUBLIC_FILE_UPLOADED_AND_SIGNED', signedBy, {
      ip: signedIp,
      filename: req.file.filename,
      originalName,
      hash: contentHash,
      signedFileHash: signedHash,
    });

    res.redirect(`/secret/${ADMIN_SECRET}/admin`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao fazer upload');
  }
});

app.post(`/secret/${ADMIN_SECRET}/admin/public-files/delete/:id`, checkAdminIP, adminAuth, (req, res) => {
  try {
    const id = req.params.id;
    const removed = publicFileRepo.remove(id);
    if (removed) {
      const filePath = path.join(__dirname, '..', 'src', 'results', removed.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    res.redirect(`/secret/${ADMIN_SECRET}/admin`);
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao deletar');
  }
});
// ------------------------------

app.get(`/secret/${ADMIN_SECRET}/admin/export.csv`, checkAdminIP, adminAuth, async (req, res) => {
  return adminController.exportCsv(req, res);
});

app.get('/api/verify/:protocol', async (req, res) => {
  const protocol = req.params.protocol;
  const record = await Promise.resolve(submissionRepo.findByProtocol(protocol));
  if (!record) return res.status(404).json({ error: 'Não encontrado' });

  const formVersion = record.formVersion || record.form_version || '';
  const project = record.project || record.blind || {};

  const payloadForHash = {
    protocol: record.protocol,
    createdAt: record.createdAt,
    form_version: formVersion,
    identified: record.identified,
    project,
  };

  const canonical = stableStringify(payloadForHash);
  const computed = sha256Hex(canonical);

  return res.json({
    protocol: record.protocol,
    storedHash: record.hash,
    computedHash: computed,
    valid: computed === record.hash,
    createdAt: record.createdAt,
    data: {
      nome: record.identified?.nome || '',
      email: record.identified?.email || '',
      cpf: record.identified?.cpf || '',
      titulo: record.project?.titulo_pt || '',
      area: record.project?.area || ''
    }
  });
});

// --- ROTAS DE AUTENTICAÇÃO ---

// Endpoint de Login
app.post(`/secret/${ADMIN_SECRET}/login`, apiLimiter, (req, res) => authController.login(req, res));

// Endpoint de Logout
app.use(`/secret/${ADMIN_SECRET}/logout`, (req, res) => {
  req.session.destroy((err) => {
    res.redirect(`/secret/${ADMIN_SECRET}/`);
  });
});

// --- ROTAS DO PORTAL DO CANDIDATO ---

// Página de consulta pública de inscrição
// --- EVENTOS (PÚBLICO) ---
const normalizeCpf = (value) => String(value || '').replace(/\D/g, '');

app.get('/eventos/:id', async (req, res) => {
  const event = await eventRepo.findById(req.params.id);
  if (!event || event.status !== 'open') return res.status(404).send('Evento não encontrado ou inscrições encerradas.');

  const syllabus = String(event.syllabus || '').trim();
  const activities = Array.isArray(event.activities) ? event.activities : [];
  const speakers = String(event.speakers || '').trim();

  const speakersHtml = speakers
    ? `
        <p><strong>Palestrante/Ministrante:</strong> ${escapeHtml(speakers)}</p>
      `
    : '';

  const syllabusHtml = syllabus
    ? `
        <hr />
        <h3>Ementa do Curso</h3>
        <div style="margin: 12px 0; white-space: pre-wrap;">${escapeHtml(syllabus)}</div>
      `
    : '';

  const activitiesHtml = activities.length
    ? (() => {
        const rows = activities.map((a) => {
          const name = escapeHtml(a && a.name ? a.name : '');
          const role = escapeHtml(a && a.role ? a.role : '');
          const workload = escapeHtml(a && a.workload != null ? String(a.workload) : '');
          return `<tr><td>${name}</td><td>${role}</td><td style="text-align:right;">${workload}</td></tr>`;
        }).join('');

        return `
          <hr />
          <h3>Atividades do Evento</h3>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align:left; border-bottom: 1px solid #ddd; padding: 8px;">Atividade</th>
                  <th style="text-align:left; border-bottom: 1px solid #ddd; padding: 8px;">Função</th>
                  <th style="text-align:right; border-bottom: 1px solid #ddd; padding: 8px;">Carga (h)</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      })()
    : '';
  
  res.send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(event.title)}</title>
      <link rel="stylesheet" href="/style.css" />
      <link rel="stylesheet" href="/theme.css" />
    </head>
    <body>
      <div class="container">
        <header class="main-header">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
              <a href="/" aria-label="Voltar para a página inicial" style="display:inline-block;">
                <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              </a>
              <h1>Inscrição em Evento</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
        </header>
        <section class="panel">
          <div class="panel-header"><h2>${escapeHtml(event.title)}</h2></div>
          <div class="panel-body">
            <div style="text-align:center; margin-bottom:20px;">
                <img src="${event.imageFilename ? '/img/events/' + event.imageFilename : '/img/post_padrao.png'}" style="max-width:100%; max-height:400px; border-radius:8px;">
            </div>
            <p><strong>Data:</strong> ${new Date(event.date).toLocaleDateString('pt-BR')}</p>
            <p><strong>Local:</strong> ${escapeHtml(event.location)}</p>
            <p><strong>Carga Horária:</strong> ${escapeHtml(event.workload)}</p>
            ${speakersHtml}
            <h3>Descrição</h3>
            <div style="margin: 12px 0; white-space: pre-wrap;">${escapeHtml(event.description)}</div>
            ${syllabusHtml}
            ${activitiesHtml}
            
            <hr />
            <h3>Inscreva-se</h3>
            <form method="POST" action="/eventos/${event.id}/inscrever">
              <div class="form-group">
                <label>Nome Completo</label>
                <input name="nome" required class="form-control" style="width: 100%; padding: 8px;" />
              </div>
              <div class="form-group">
                <label>Email</label>
                <input name="email" type="email" required class="form-control" style="width: 100%; padding: 8px;" />
              </div>
              <div class="form-group">
                <label>CPF</label>
                <input name="cpf" required placeholder="000.000.000-00" class="form-control" style="width: 100%; padding: 8px;" />
              </div>
              <br/>
              <button class="btn-primary" type="submit">Confirmar Inscrição</button>
            </form>

            <hr />
            <h3>Gerar Certificado</h3>
            <p>Digite o mesmo CPF usado na inscrição para gerar seu certificado.</p>
            <form method="POST" action="/eventos/${event.id}/certificado" target="_blank">
              <div class="form-group">
                <label>CPF</label>
                <input name="cpf" required placeholder="000.000.000-00" class="form-control" style="width: 100%; padding: 8px;" />
              </div>
              <br/>
              <button class="btn-primary" type="submit">Gerar Certificado (PDF)</button>
            </form>
          </div>
        </section>
      </div>
    </body>
    </html>
  `);
});

app.post('/eventos/:id/inscrever', async (req, res) => {
  const event = await eventRepo.findById(req.params.id);
  if (!event || event.status !== 'open') return res.status(404).send('Evento não encontrado ou inscrições encerradas.');

  const { nome, email, cpf } = req.body;
  if (!nome || !email || !cpf) return res.status(400).send('Todos os campos são obrigatórios.');

  const cpfNorm = normalizeCpf(cpf);
  if (cpfNorm.length !== 11) return res.status(400).send('CPF inválido.');

  if (event.registrations.some(r => normalizeCpf(r.cpf) === cpfNorm)) {
      return res.send(`
        <!doctype html>
        <html>
        <head><link rel="stylesheet" href="/theme.css" /></head>
        <body>
          <div class="container" style="text-align:center; margin-top:50px;">
            <h1>Atenção</h1>
            <p>O CPF <strong>${escapeHtml(cpf)}</strong> já está inscrito neste evento.</p>
            <a href="/eventos/${event.id}" class="btn-primary">Voltar</a>
          </div>
        </body>
        </html>
      `);
  }

  event.registrations.push({
      nome,
      email,
      cpf: cpfNorm,
      role: event.participantRole || 'PARTICIPANTE',
      registeredAt: new Date().toISOString()
  });

  await eventRepo.save(event);

  res.send(`
    <!doctype html>
    <html>
    <head><link rel="stylesheet" href="/theme.css" /></head>
    <body>
      <div class="container" style="text-align:center; margin-top:50px;">
        <h1>Inscrição Confirmada!</h1>
        <p>Obrigado, ${escapeHtml(nome)}. Sua inscrição no evento <strong>${escapeHtml(event.title)}</strong> foi realizada com sucesso.</p>
        <a href="/" class="btn-primary">Voltar ao Início</a>
      </div>
    </body>
    </html>
  `);
});

// Gerar certificado (público) condicionado ao CPF do inscrito
app.post('/eventos/:id/certificado', apiLimiter, async (req, res) => {
  try {
    const event = await eventRepo.findById(req.params.id);
    if (!event) return res.status(404).send('Evento não encontrado.');

    const cpfInput = String(req.body?.cpf || '');
    const cpfNorm = normalizeCpf(cpfInput);
    if (cpfNorm.length !== 11) return res.status(400).send('CPF inválido.');

    const registration = (event.registrations || []).find(r => normalizeCpf(r?.cpf) === cpfNorm);
    if (!registration) {
      return res.status(404).send(`
        <!doctype html>
        <html>
        <head><link rel="stylesheet" href="/theme.css" /></head>
        <body>
          <div class="container" style="text-align:center; margin-top:50px;">
            <h1>Não encontrado</h1>
            <p>Não encontramos inscrição para este CPF neste evento.</p>
            <a href="/eventos/${event.id}" class="btn-primary">Voltar</a>
          </div>
        </body>
        </html>
      `);
    }

    // Validação de data do evento
    const eventDate = new Date(event.date);
    const now = new Date();
    // Zera as horas para comparar apenas datas, se desejar, ou compara direto
    // Vamos permitir gerar se for o dia seguinte ou se o admin já confirmou (o admin confirmar é soberano?)
    // O requisito diz: "limitar gerar o certificado só após o prazo"
    // Vamos assumir que se o evento é hoje, ainda não acabou. Então só amanhã.
    // Mas se o admin já foi lá e marcou "Sim", talvez devesse liberar.
    // Vou seguir estritamente: Data atual deve ser maior que data do evento.
    // Se eventDate é 2023-10-27 (00:00), e now é 2023-10-27 (15:00), now > eventDate.
    // Então se for no mesmo dia, libera.
    
    if (now < eventDate) {
       return res.status(403).send(`
        <!doctype html>
        <html>
        <head><link rel="stylesheet" href="/theme.css" /></head>
        <body>
          <div class="container" style="text-align:center; margin-top:50px;">
            <h1>Aguarde</h1>
            <p>O certificado só estará disponível após a data do evento.</p>
            <a href="/eventos/${event.id}" class="btn-primary">Voltar</a>
          </div>
        </body>
        </html>
      `);
    }

    // Validação de confirmação de presença
    if (!registration.confirmed) {
       return res.status(403).send(`
        <!doctype html>
        <html>
        <head><link rel="stylesheet" href="/theme.css" /></head>
        <body>
          <div class="container" style="text-align:center; margin-top:50px;">
            <h1>Presença não confirmada</h1>
            <p>Sua presença ainda não foi confirmada pela organização do evento.</p>
            <p>Entre em contato com a administração se você participou.</p>
            <a href="/eventos/${event.id}" class="btn-primary">Voltar</a>
          </div>
        </body>
        </html>
      `);
    }

    const auditInfo = {
      ip: getClientIP(req),
      user: { username: 'public' },
      createdAt: new Date(),
    };

    const pdfBuffer = await pdfService.generateCertificatePdf({
      nome: registration.nome,
      cpf: registration.cpf,
      curso: event.title,
      data: event.date ? new Date(event.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : '',
      cargaHoraria: event.workload,
      coordinator: event.coordinator,
      department: event.department,
      speakers: event.speakers,
      role: registration.role || event.participantRole || 'PARTICIPANTE',
      syllabus: event.syllabus,
      activities: event.activities,
      textoLivre: '',
    }, auditInfo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificado-${String(registration.nome || 'participante').replace(/\s+/g, '_')}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Erro ao gerar certificado (público):', err);
    return res.status(500).send('Erro ao gerar certificado');
  }
});

app.get('/consulta', (req, res) => {
  const error = req.query.error;
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <title>Consultar Inscrição - PLANTERR</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #001f3f 0%, #003d73 50%, #0059a6 100%);
          background-attachment: fixed;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }
        body::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url('/img/back_index.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.3;
          z-index: 0;
        }
        .auth-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 460px;
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          padding: 40px 32px;
        }
        .auth-header {
          text-align: center;
          margin-bottom: 10px;
        }
        .auth-header img {
          max-height: 64px;
          width: auto;
          margin: 0 8px;
        }
        .auth-title {
          color: #003366;
          font-size: 22px;
          font-weight: 600;
          margin: 16px 0 8px;
          text-align: center;
        }
        .auth-subtitle {
          color: #666;
          font-size: 14px;
          text-align: center;
          margin-bottom: 28px;
          line-height: 1.5;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          color: #333;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 6px;
        }
        .form-group input {
          width: 100%;
          padding: 12px 16px;
          font-size: 15px;
          border: 1px solid #ccc;
          border-radius: 8px;
          background: #fff;
          transition: all 0.2s;
          outline: none;
        }
        .form-group input:focus {
          border-color: #003366;
          box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
        }
        .form-hint {
          font-size: 12px;
          color: #777;
          margin-top: 4px;
        }
        .btn-submit {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #003366 0%, #004d99 100%);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 8px;
        }
        .btn-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #002244 0%, #003d73 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 51, 102, 0.3);
        }
        .btn-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .btn-secondary {
          display: block;
          width: 100%;
          padding: 12px;
          background: #fff;
          color: #003366;
          border: 2px solid #003366;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 12px;
        }
        .btn-secondary:hover {
          background: #f0f5fa;
        }
        .error-msg {
          background: #fee;
          border-left: 4px solid #c33;
          color: #c33;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 16px;
        }
        .info-box {
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          color: #1565c0;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 20px;
          line-height: 1.5;
        }
        @media (max-width: 480px) {
          .auth-container { padding: 32px 24px; }
          .auth-header img { max-height: 48px; }
        }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <div class="auth-header">
          <a href="/" aria-label="Voltar para a página inicial" style="display:inline-block;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR">
          </a>
          <img src="/img/logo_avalia_quadrado.png" alt="Logo AVALIA+">
        </div>
        <h1 class="auth-title">Consultar Inscrição</h1>
        <p class="auth-subtitle">Acompanhe o status da sua candidatura no Processo Seletivo PLANTERR - AVALIA+</p>

        ${error ? `<div class="error-msg">${escapeHtml(error)}</div>` : ''}

        <div class="info-box">
          📋 Para consultar sua inscrição, informe o <strong>número do protocolo</strong> e seu <strong>CPF</strong> cadastrados no momento da inscrição.
        </div>

        <form method="POST" action="/consulta">
          <div class="form-group">
            <label for="protocol">Número do Protocolo</label>
            <input id="protocol" type="text" name="protocol" placeholder="Ex.: PLANTERR-2025-ABC123" required>
            <div class="form-hint">Você recebeu este número ao finalizar a inscrição</div>
          </div>
          <div class="form-group">
            <label for="cpf">CPF</label>
            <input id="cpf" type="text" name="cpf" placeholder="000.000.000-00" maxlength="14" required>
            <div class="form-hint">Digite apenas números ou com pontuação</div>
          </div>
          <button class="btn-submit" type="submit">Consultar</button>
        </form>

        <a href="/" class="btn-secondary">← Voltar para página inicial</a>
      </div>
      <script>
        // Máscara de CPF
        document.getElementById('cpf').addEventListener('input', function(e) {
          let value = e.target.value.replace(/\\D/g, '');
          if (value.length > 11) value = value.slice(0, 11);
          
          if (value.length > 9) {
            value = value.replace(/(\\d{3})(\\d{3})(\\d{3})(\\d{1,2})/, '$1.$2.$3-$4');
          } else if (value.length > 6) {
            value = value.replace(/(\\d{3})(\\d{3})(\\d{1,3})/, '$1.$2.$3');
          } else if (value.length > 3) {
            value = value.replace(/(\\d{3})(\\d{1,3})/, '$1.$2');
          }
          
          e.target.value = value;
        });
      </script>
    </body>
    </html>
  `);
});

// Processar consulta de inscrição
app.post('/consulta', async (req, res) => {
  try {
    const protocol = String(req.body?.protocol || '').trim();
    const cpfInput = String(req.body?.cpf || '').replace(/\D/g, '');

    if (!protocol || !cpfInput) {
      return res.redirect('/consulta?error=' + encodeURIComponent('Por favor, preencha todos os campos.'));
    }

    // Buscar submissão pelo protocolo
    const submission = await Promise.resolve(submissionRepo.findByProtocol(protocol));

    if (!submission) {
      return res.redirect('/consulta?error=' + encodeURIComponent('Protocolo não encontrado. Verifique se digitou corretamente.'));
    }

    // Validar CPF
    const submissionCpf = String(submission.identified?.cpf || '').replace(/\D/g, '');
    if (submissionCpf !== cpfInput) {
      logSecurityEvent('CANDIDATE_PORTAL_AUTH_FAILED', { protocol, reason: 'CPF mismatch' });
      return res.redirect('/consulta?error=' + encodeURIComponent('CPF não corresponde ao protocolo informado.'));
    }

    // Criar sessão temporária para o candidato
    req.session.candidateProtocol = protocol;
    req.session.candidateCpf = cpfInput;
    
    logSecurityEvent('CANDIDATE_PORTAL_AUTH_SUCCESS', { protocol });
    
    return res.redirect('/candidato/status');
  } catch (err) {
    console.error('Erro na consulta:', err);
    return res.redirect('/consulta?error=' + encodeURIComponent('Erro ao processar consulta. Tente novamente.'));
  }
});

// Página de status do candidato
app.get('/candidato/status', async (req, res) => {
  // Verificar se o candidato está autenticado
  if (!req.session.candidateProtocol || !req.session.candidateCpf) {
    return res.redirect('/consulta?error=' + encodeURIComponent('Sessão expirada. Por favor, faça a consulta novamente.'));
  }

  try {
    const protocol = req.session.candidateProtocol;
    const submission = await Promise.resolve(submissionRepo.findByProtocol(protocol));

    if (!submission) {
      req.session.candidateProtocol = null;
      req.session.candidateCpf = null;
      return res.redirect('/consulta?error=' + encodeURIComponent('Inscrição não encontrada.'));
    }

    // Verificar CPF novamente por segurança
    const submissionCpf = String(submission.identified?.cpf || '').replace(/\D/g, '');
    if (submissionCpf !== req.session.candidateCpf) {
      req.session.candidateProtocol = null;
      req.session.candidateCpf = null;
      return res.redirect('/consulta');
    }

    // Formatar data de submissão
    const formatDate = (dateStr) => {
      if (!dateStr) return '—';
      try {
        return new Date(dateStr).toLocaleString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return dateStr;
      }
    };

    const normalizeStatus = (status) => {
      const s = String(status || '').trim().toLowerCase();
      if (!s) return 'Recebido';
      if (s === 'recebido' || s === 'recebida') return 'Recebido';
      if (s === 'em análise' || s === 'em analise') return 'Em Análise';
      if (s === 'aprovado' || s === 'aprovada') return 'Aprovado';
      if (s === 'reprovado' || s === 'reprovada') return 'Reprovado';
      if (s === 'indeferido' || s === 'indeferida') return 'Indeferido';
      return status;
    };

    const statusColor = {
      'Recebido': '#2196f3',
      'Recebida': '#2196f3',
      'Em Análise': '#ff9800',
      'Aprovado': '#4caf50',
      'Reprovado': '#f44336',
      'Indeferido': '#9e9e9e'
    };

    const currentStatus = normalizeStatus(submission.status);
    const statusBgColor = statusColor[currentStatus] || '#2196f3';

    // Elegibilidade de recurso (workflow): mostra botão somente quando há reprovação preliminar
    // e o prazo da fase de recurso correspondente está aberto.
    const now = new Date();
    const year = workflowService.getEditalYearForSubmission(protocol);
    const parentToAppeal = {
      [PHASE.INSCRICAO]: PHASE.RECURSO_INSCRICAO,
      [PHASE.PROJETO]: PHASE.RECURSO_PROJETO,
      [PHASE.ENTREVISTA]: PHASE.RECURSO_ENTREVISTA,
      [PHASE.LINGUA]: PHASE.RECURSO_LINGUA,
    };
    const parentLabels = {
      [PHASE.INSCRICAO]: { label: 'Inscrição', etapaValue: 'Inscrição' },
      [PHASE.PROJETO]: { label: 'Avaliação do Projeto', etapaValue: 'Avaliação do Projeto' },
      [PHASE.ENTREVISTA]: { label: 'Entrevista', etapaValue: 'Entrevista' },
      [PHASE.LINGUA]: { label: 'Prova de Língua Estrangeira', etapaValue: 'Prova de Língua Estrangeira' },
    };

    const appealOptions = [];
    for (const parentPhaseKey of Object.keys(parentToAppeal)) {
      const parentStatus = await workflowService.getStatus(year, protocol, parentPhaseKey);
      if (parentStatus !== STATUS.REPROVADO_PRELIMINAR) continue;

      let within = false;
      try {
        workflowService.assertWithinPhase(year, parentToAppeal[parentPhaseKey], now);
        within = true;
      } catch {
        within = false;
      }

      if (within) {
        appealOptions.push(parentLabels[parentPhaseKey]);
      }
    }

    const qsBase = new URLSearchParams({
      protocolo_inscricao: submission.protocol || '',
      nome: submission.identified?.nome || '',
      cpf: submission.identified?.cpf || '',
      email: submission.identified?.email || '',
      titulo_projeto: submission.project?.titulo_pt || '',
      linha_pesquisa: submission.project?.area || '',
    });

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <title>Minha Inscrição - PLANTERR</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/style.css" />
        <link rel="stylesheet" href="/theme.css" />
        <style>
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            background: ${statusBgColor};
            color: white;
            border-radius: 3px;
            font-weight: bold;
            font-size: 10px;
            margin-left: 10px;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 10px;
            margin-top: 10px;
          }
          .info-item {
            padding: 8px;
            background: #fff;
            border: 1px solid #7F9DB9;
            font-size: 11px;
          }
          .info-label {
            font-size: 10px;
            color: #003366;
            margin-bottom: 2px;
            font-weight: bold;
          }
          .info-value {
            font-size: 11px;
            color: #000;
            word-break: break-word;
          }
          .timeline {
            padding: 10px 0;
          }
          .timeline-item {
            position: relative;
            padding-left: 30px;
            margin-bottom: 15px;
            font-size: 11px;
          }
          .timeline-item::before {
            content: '';
            position: absolute;
            left: 8px;
            top: 8px;
            bottom: -15px;
            width: 1px;
            background: #ccc;
          }
          .timeline-item:last-child::before {
            display: none;
          }
          .timeline-dot {
            position: absolute;
            left: 0;
            top: 0;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #f4f4f4;
            border: 2px solid #ccc;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .timeline-item.inactive .timeline-title {
            color: #666;
            font-weight: normal;
          }
          .timeline-item.inactive .timeline-date {
            color: #999;
          }
          
          /* Status Colors */
          .timeline-dot.completed {
            border-color: #4caf50;
            background: #4caf50;
          }
          .timeline-dot.completed::after {
            content: '✓';
            color: white;
            font-weight: bold;
            font-size: 10px;
          }
          
          .timeline-dot.in-progress {
            border-color: #ff9800;
            background: #ff9800;
          }
          .timeline-dot.in-progress::after {
            content: '⋯'; /* Ellipsis for in progress */
            color: white;
            font-weight: bold;
            font-size: 10px;
            margin-top: -4px;
          }

          .timeline-dot.rejected {
            border-color: #f44336;
            background: #f44336;
          }
          .timeline-dot.rejected::after {
            content: '✕';
            color: white;
            font-weight: bold;
            font-size: 10px;
          }

          .timeline-title {
            font-weight: bold;
            color: #003366;
            margin-bottom: 2px;
          }
          .timeline-date {
            font-size: 10px;
            color: #666;
          }
          .doc-list {
            list-style: none;
            padding: 0;
            margin: 5px 0 0 0;
          }
          .doc-item {
            padding: 8px;
            background: #F4F9FD;
            border: 1px solid #86A3C2;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
          }
          .doc-name {
            font-weight: bold;
            color: #003366;
          }
          .doc-link {
            padding: 3px 8px;
            background: #003366;
            color: white;
            text-decoration: none;
            border-radius: 2px;
            font-size: 10px;
          }
          .doc-link:hover {
            background: #002244;
          }
          .btn-logout {
            padding: 5px 10px;
            background: #d9534f;
            color: white;
            text-decoration: none;
            border-radius: 2px;
            font-size: 11px;
            font-weight: bold;
            display: inline-block;
          }
          .btn-logout:hover {
            background: #c9302c;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
              <a href="/" aria-label="Voltar para a página inicial" style="display:inline-block;">
                <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              </a>
              <div>
                <h1 style="margin:0; font-size: 1.5em;">Portal do Candidato</h1>
                <p style="margin:5px 0 0 0; font-size: 1em; color: #555;">Acompanhe sua inscrição no Processo Seletivo PLANTERR</p>
              </div>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          <section class="panel">
            <div class="panel-body" style="text-align:right;">
              <a href="/candidato/sair" class="btn-logout">Sair</a>
            </div>
          </section>

          <div class="panel">
            <div class="panel-header">
              <h2>Status da Inscrição<span class="status-badge">${escapeHtml(currentStatus)}</span></h2>
            </div>
            <div class="panel-body">
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Protocolo</div>
                  <div class="info-value">${escapeHtml(submission.protocol || '—')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Nome Completo</div>
                  <div class="info-value">${escapeHtml(submission.identified?.nome || '—')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">E-mail</div>
                  <div class="info-value">${escapeHtml(submission.identified?.email || '—')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Data da Inscrição</div>
                  <div class="info-value">${formatDate(submission.createdAt)}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Título do Projeto</div>
                  <div class="info-value">${escapeHtml(submission.project?.titulo_pt || '—')}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Linha de Pesquisa</div>
                  <div class="info-value">${escapeHtml(submission.project?.area || '—')}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h2>Linha do Tempo</h2>
            </div>
            <div class="panel-body">
              <div class="timeline">
                <div class="timeline-item">
                  <div class="timeline-dot completed"></div>
                  <div class="timeline-title">Inscrição Realizada</div>
                  <div class="timeline-date">${formatDate(submission.createdAt)}</div>
                </div>
                <div class="timeline-item ${currentStatus === 'Recebido' ? 'inactive' : ''}">
                  <div class="timeline-dot ${
                    currentStatus === 'Recebido' ? '' : 
                    (currentStatus === 'Em análise' || currentStatus === 'Em recurso') ? 'in-progress' :
                    (currentStatus === 'Aprovada' || currentStatus === 'Aprovado') ? 'completed' :
                    (currentStatus === 'Reprovada' || currentStatus === 'Reprovado' || currentStatus === 'Indeferido') ? 'rejected' :
                    'in-progress'
                  }"></div>
                  <div class="timeline-title">Em Análise</div>
                  <div class="timeline-date">${
                    currentStatus === 'Recebido' ? 'Aguardando' :
                    (currentStatus === 'Aprovada' || currentStatus === 'Aprovado') ? 'Aprovada' :
                    (currentStatus === 'Reprovada' || currentStatus === 'Reprovado') ? 'Reprovada' :
                    (currentStatus === 'Indeferido') ? 'Indeferida' :
                    'Em andamento'
                  }</div>
                </div>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h2>Documentos Enviados</h2>
            </div>
            <div class="panel-body">
              <ul class="doc-list">
                <li class="doc-item">
                  <span class="doc-name">📄 Comprovante de Inscrição</span>
                  <a href="/candidato/comprovante.pdf" class="doc-link" target="_blank" rel="noopener noreferrer">Visualizar PDF</a>
                </li>
                ${submission.pdfProjeto ? `
                <li class="doc-item">
                  <span class="doc-name">📄 Projeto de Pesquisa</span>
                  <a href="/candidato/documento/projeto" class="doc-link">Visualizar PDF</a>
                </li>
                ` : ''}
                ${submission.pdfIdioma ? `
                <li class="doc-item">
                  <span class="doc-name">📄 Certificado de Idioma</span>
                  <a href="/candidato/documento/idioma" class="doc-link">Visualizar PDF</a>
                </li>
                ` : ''}
                ${!submission.pdfProjeto && !submission.pdfIdioma ? '' : ''}
              </ul>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h2>Recurso</h2>
            </div>
            <div class="panel-body">
              <div class="instructions">
                O recurso é liberado somente quando você estiver <strong>reprovado(a) preliminarmente</strong> em alguma etapa e o <strong>prazo de recurso</strong> estiver aberto.
              </div>

              ${appealOptions.length > 0
                ? `<div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                    ${appealOptions
                      .map((opt) => {
                        const qs = new URLSearchParams(qsBase);
                        qs.set('etapa_processo', opt.etapaValue);
                        return `<a class="btn-primary" href="/recurso.html?${qs.toString()}">Interpor recurso: ${escapeHtml(opt.label)}</a>`;
                      })
                      .join('')}
                  </div>`
                : `<div class="instructions" style="margin-top:10px;">
                    Nenhum recurso disponível no momento.
                  </div>`}
            </div>
          </div>

          <div class="panel">
            <div class="panel-header">
              <h2>Próximos Passos</h2>
            </div>
            <div class="panel-body">
              <div class="instructions">
                ${currentStatus === 'Recebido' ? '<strong>⏳ Aguarde</strong> a análise da sua inscrição pela comissão avaliadora.' : ''}
                ${currentStatus === 'Em Análise' ? '<strong>🔍 Em avaliação</strong> - A comissão está analisando sua inscrição.' : ''}
                ${currentStatus === 'Aprovado' ? '<strong>✅ Próximo passo:</strong> Aguarde o contato para as etapas seguintes (entrevista, análise de idioma).' : ''}
                ${currentStatus === 'Reprovado' ? '<strong>📝 Recurso disponível:</strong> Você pode entrar com recurso dentro do prazo estabelecido no edital.' : ''}
                ${currentStatus === 'Indeferido' ? '<strong>❌ Inscrição indeferida.</strong> Consulte o edital ou entre em contato para mais informações.' : ''}
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Erro ao exibir status:', err);
    return res.redirect('/consulta?error=' + encodeURIComponent('Erro ao carregar informações.'));
  }
});

// Logout do candidato
app.get('/candidato/sair', (req, res) => {
  req.session.candidateProtocol = null;
  req.session.candidateCpf = null;
  res.redirect('/consulta');
});

// Download do comprovante (PDF) da inscrição do candidato (template oficial)
app.get('/candidato/comprovante.pdf', async (req, res) => {
  // Verificar autenticação
  if (!req.session.candidateProtocol || !req.session.candidateCpf) {
    return res.status(401).send('Não autorizado. Faça login novamente.');
  }

  try {
    const protocol = req.session.candidateProtocol;
    const submission = await Promise.resolve(submissionRepo.findByProtocol(protocol));

    if (!submission) {
      return res.status(404).send('Inscrição não encontrada.');
    }

    // Verificar CPF
    const submissionCpf = String(submission.identified?.cpf || '').replace(/\D/g, '');
    if (submissionCpf !== req.session.candidateCpf) {
      req.session.candidateProtocol = null;
      req.session.candidateCpf = null;
      return res.status(403).send('Acesso negado.');
    }

    const auditInfo = {
      ip: getClientIP(req),
      user: { username: 'candidato' },
      userAgent: req.get('User-Agent') || 'unknown',
      createdAt: submission.createdAt ? new Date(submission.createdAt) : new Date(),
      hash: submission.hash,
    };

    const pdfBuffer = await pdfService.generateSubmissionPdf(submission, auditInfo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="inscricao-${protocol}.pdf"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Erro ao gerar comprovante (candidato):', err);
    return res.status(500).send('Erro ao gerar comprovante.');
  }
});

// Download de documentos do candidato
app.get('/candidato/documento/:tipo', async (req, res) => {
  // Verificar autenticação
  if (!req.session.candidateProtocol || !req.session.candidateCpf) {
    return res.status(401).send('Não autorizado. Faça login novamente.');
  }

  try {
    const protocol = req.session.candidateProtocol;
    const tipo = req.params.tipo;
    const submission = await Promise.resolve(submissionRepo.findByProtocol(protocol));

    if (!submission) {
      return res.status(404).send('Inscrição não encontrada.');
    }

    // Verificar CPF
    const submissionCpf = String(submission.identified?.cpf || '').replace(/\D/g, '');
    if (submissionCpf !== req.session.candidateCpf) {
      return res.status(403).send('Acesso negado.');
    }

    let pdfData = null;
    let filename = '';

    if (tipo === 'projeto' && submission.pdfProjeto) {
      pdfData = submission.pdfProjeto;
      filename = `projeto_${protocol}.pdf`;
    } else if (tipo === 'idioma' && submission.pdfIdioma) {
      pdfData = submission.pdfIdioma;
      filename = `idioma_${protocol}.pdf`;
    } else {
      return res.status(404).send('Documento não encontrado.');
    }

    // Converter base64 para buffer
    const buffer = Buffer.from(pdfData, 'base64');
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Erro ao baixar documento:', err);
    return res.status(500).send('Erro ao processar documento.');
  }
});

// Verificar status de autenticação
app.get(`/secret/${ADMIN_SECRET}/auth-status`, (req, res) => {
  const token = req.session.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  
  if (!token) return res.json({ authenticated: false });
  
  try {
    jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true });
  } catch (e) {
    res.json({ authenticated: false });
  }
});

// Redirecionamento da raiz secreta para login ou admin
app.get(`/secret/${ADMIN_SECRET}/`, (req, res) => {
  if (req.session.token) {
    try {
      const decoded = jwt.verify(req.session.token, JWT_SECRET);
      if (decoded.role === 'admin') {
        return res.redirect(`/secret/${ADMIN_SECRET}/admin`);
      } else if (decoded.role === 'evaluator') {
        return res.redirect(`/secret/${ADMIN_SECRET}/evaluator/${decoded.line}/${decoded.num}`);
      }
    } catch (e) {
      // Token inválido, continua para login
    }
  }
  // Servir página de login (gradiente azul estilo Sagres/UEFS, centralizado, campos arredondados)
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <title>Acesso Restrito</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #001f3f 0%, #003d73 50%, #0059a6 100%);
          background-attachment: fixed;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }
        body::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: url('/img/back_index.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.3;
          z-index: 0;
        }
        .auth-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          padding: 40px 32px;
        }
        .auth-header {
          text-align: center;
          margin-bottom: 10px;
        }
        .auth-header img {
          max-height: 64px;
          width: auto;
          margin: 0 8px;
        }
        .auth-title {
          color: #003366;
          font-size: 20px;
          font-weight: 600;
          margin: 16px 0 8px;
          text-align: center;
        }
        .auth-subtitle {
          color: #666;
          font-size: 14px;
          text-align: center;
          margin-bottom: 28px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          color: #333;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 6px;
        }
        .form-group input {
          width: 100%;
          padding: 12px 16px;
          font-size: 15px;
          border: 1px solid #ccc;
          border-radius: 8px;
          background: #fff;
          transition: all 0.2s;
          outline: none;
        }
        .form-group input:focus {
          border-color: #003366;
          box-shadow: 0 0 0 3px rgba(0, 51, 102, 0.1);
        }
        .btn-submit {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #003366 0%, #004d99 100%);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 8px;
        }
        .btn-submit:hover:not(:disabled) {
          background: linear-gradient(135deg, #002244 0%, #003d73 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 51, 102, 0.3);
        }
        .btn-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .error-msg {
          background: #fee;
          border-left: 4px solid #c33;
          color: #c33;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 16px;
          display: none;
        }
        .error-msg.show { display: block; }

        .auth-footer {
          margin-top: 18px;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        @media (max-width: 480px) {
          .auth-container { padding: 32px 24px; }
          .auth-header img { max-height: 48px; }
        }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <div class="auth-header">
          <img src="/img/logo_planter.png" alt="Logo PLANTERR">
          <img src="/img/logo_avalia_quadrado.png" alt="Logo AVALIA+">
        </div>
        <h1 class="auth-title">Acesso Restrito</h1>
        <p class="auth-subtitle">Administração do Processo Seletivo - AVALIA+</p>

        <div id="error-msg" class="error-msg"></div>

        <form id="login-form">
          <div class="form-group">
            <label for="username">Usuário</label>
            <input id="username" type="text" name="username" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Senha</label>
            <input id="password" type="password" name="password" required autocomplete="current-password">
          </div>
          <button class="btn-submit" type="submit" id="btn-submit">Entrar</button>
        </form>

        <div class="auth-footer">&copy; ${new Date().getFullYear()} Avalia Mais. Todos os direitos reservados.</div>
      </div>
      <script>
        document.getElementById('login-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const btn = document.getElementById('btn-submit');
          const errDiv = document.getElementById('error-msg');
          
          btn.disabled = true;
          btn.textContent = 'Entrando...';
          errDiv.classList.remove('show');
          
          const formData = new FormData(e.target);
          const data = {};
          formData.forEach((value, key) => data[key] = value);
          
          try {
            const res = await fetch('/secret/${ADMIN_SECRET}/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });

            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              const text = await res.text();
              console.error("Resposta não-JSON recebida:", text);
              throw new Error("Erro de comunicação com o servidor (CORS ou erro interno).");
            }
            
            const result = await res.json();
            
            if (result.success) {
              btn.textContent = 'Sucesso!';
              window.location.href = result.redirect;
            } else {
              throw new Error(result.error || 'Credenciais inválidas');
            }
          } catch (err) {
            console.error(err);
            errDiv.textContent = err.message || 'Erro de conexão. Tente novamente.';
            errDiv.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Entrar';
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.get(`/secret/${ADMIN_SECRET}/admin`, checkAdminIP, adminAuth, async (req, res) => {
  return adminController.index(req, res);
});

app.get(`/secret/${ADMIN_SECRET}/admin/selection`, checkAdminIP, adminAuth, async (req, res) => {
  return adminController.dashboard(req, res);
});

app.post(`/secret/${ADMIN_SECRET}/admin/active-year`, checkAdminIP, adminAuth, (req, res) => {
  try {
    const yearRaw = String(req.body?.year || '').trim();
    const year = Number(yearRaw);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return res.status(400).send('Ano inválido');
    }

    storage.setActiveEditalYear(year);
    // Garante que o calendário do ano exista (sem necessidade de pré-seed manual)
    calendarRepo.getOrCreateYear(year, { seedRegistrationWindow: storage.getRegistrationWindow() });

    return res.redirect(`/secret/${ADMIN_SECRET}/admin/selection?year=${encodeURIComponent(String(year))}`);
  } catch (err) {
    return res.status(500).send('Falha ao salvar ano ativo');
  }
});

// --- GESTÃO DE EVENTOS ---
app.get(`/secret/${ADMIN_SECRET}/admin/events`, checkAdminIP, adminAuth, async (req, res) => {
  const events = await eventRepo.findAll();
  events.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.send(adminDashboardPresenter.renderEventsList(events));
});

app.get(`/secret/${ADMIN_SECRET}/admin/events/new`, checkAdminIP, adminAuth, (req, res) => {
  res.send(adminDashboardPresenter.renderEventForm());
});

app.get(`/secret/${ADMIN_SECRET}/admin/events/:id/edit`, checkAdminIP, adminAuth, async (req, res) => {
  const event = await eventRepo.findById(req.params.id);
  if (!event) return res.status(404).send('Evento não encontrado');
  res.send(adminDashboardPresenter.renderEventForm(event));
});

app.post(`/secret/${ADMIN_SECRET}/admin/events`, checkAdminIP, adminAuth, uploadEventImage.single('image'), async (req, res) => {
  const { title, description, date, location, workload, status, coordinator, department, speakers, participantRole, syllabus, activities } = req.body;
  const crypto = require('crypto');
  
  // Parse activities JSON if it's a string
  let parsedActivities = [];
  if (activities) {
    try {
      parsedActivities = typeof activities === 'string' ? JSON.parse(activities) : activities;
    } catch (e) {
      parsedActivities = [];
    }
  }
  
  const newEvent = {
      id: crypto.randomUUID(),
      title,
      description: description || '',
      date,
      location: location || '',
      workload: workload || '',
      status: status || 'draft',
      coordinator: coordinator || '',
      department: department || '',
      speakers: speakers || '',
      participantRole: participantRole || 'PARTICIPANTE',
      syllabus: syllabus || '',
      activities: parsedActivities,
      imageFilename: req.file ? req.file.filename : null,
      registrations: [],
      audit: {}
  };
  await eventRepo.save(newEvent);
  res.redirect(`/secret/${ADMIN_SECRET}/admin/events`);
});

app.post(`/secret/${ADMIN_SECRET}/admin/events/:id/edit`, checkAdminIP, adminAuth, uploadEventImage.single('image'), async (req, res) => {
    const event = await eventRepo.findById(req.params.id);
    if (!event) return res.status(404).send('Evento não encontrado');

    const { title, description, date, location, workload, status, coordinator, department, speakers, participantRole, syllabus, activities } = req.body;
    
    // Parse activities JSON if it's a string
    let parsedActivities = [];
    if (activities) {
      try {
        parsedActivities = typeof activities === 'string' ? JSON.parse(activities) : activities;
      } catch (e) {
        parsedActivities = event.activities || [];
      }
    }
    
    if (title) event.title = title;
    event.description = description;
    if (date) event.date = date;
    event.location = location;
    event.workload = workload;
    if (status) event.status = status;
    event.coordinator = coordinator || '';
    event.department = department || '';
    event.speakers = speakers || '';
    event.participantRole = participantRole || 'PARTICIPANTE';
    event.syllabus = syllabus || '';
    event.activities = parsedActivities;

    if (req.file) {
      event.imageFilename = req.file.filename;
    }

    await eventRepo.save(event);
    res.redirect(`/secret/${ADMIN_SECRET}/admin/events`);
});

app.post(`/secret/${ADMIN_SECRET}/admin/events/:id/delete`, checkAdminIP, adminAuth, async (req, res) => {
    await eventRepo.delete(req.params.id);
    res.redirect(`/secret/${ADMIN_SECRET}/admin/events`);
});

// --- FAQ / AJUDA ---
app.get(`/secret/${ADMIN_SECRET}/admin/faq`, checkAdminIP, adminAuth, (req, res) => {
  const faq = faqRepo.get();
  const saved = String(req.query.saved || '') === '1';

  const payload = {
    updatedAt: faq?.updatedAt || null,
    sections: Array.isArray(faq?.sections) ? faq.sections : [],
  };

  const html = `
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Admin - FAQ / Ajuda</title>
      <link rel="stylesheet" href="/style.css" />
      <link rel="stylesheet" href="/theme.css" />
      <style>
        .hint { color: #003366; font-size: 11px; }
        .faq-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .faq-item { border: 1px solid #86A3C2; background: #fff; padding: 10px; }
        .faq-row { display: grid; grid-template-columns: 1fr; gap: 6px; }
        .faq-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 10px; }
        .btn-danger { background-color:#d9534f; border-color:#d43f3a; color:white; }
        .ok { text-align:center; color:#2e7d32; font-weight: bold; margin: 6px 0 0; }
        textarea { min-height: 90px; }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px; flex-wrap:wrap;">
            <a href="/secret/${ADMIN_SECRET}/admin" aria-label="Voltar ao admin" style="display:inline-block;">
              <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            </a>
            <div style="text-align:center;">
              <h1 style="margin:0; font-size: 1.5em;">FAQ / Ajuda</h1>
              <p style="margin:5px 0 0 0; font-size: 1em; color: #555;">Edite as perguntas e respostas do site</p>
            </div>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'faq' })}

        <section class="panel">
          <div class="panel-header"><h2>Configuração</h2></div>
          <div class="panel-body">
            <div class="hint">
              - O conteúdo é salvo no servidor (persistente) e aparece em <strong>/suporte.html</strong> automaticamente.<br/>
              - Evite colar HTML; use texto simples (quebras de linha serão mantidas).
            </div>
            ${saved ? '<div class="ok">Salvo com sucesso.</div>' : ''}
            <div class="admin-actions" style="justify-content:center; margin-top: 10px;">
              <a class="btn-secondary" href="/suporte.html" target="_blank" rel="noopener noreferrer">Ver Ajuda (público)</a>
            </div>
          </div>
        </section>

        <form id="faq-form" method="POST" action="/secret/${ADMIN_SECRET}/admin/faq">
          <input type="hidden" name="payload" id="payload" />

          <section class="panel">
            <div class="panel-header"><h2>Seções</h2></div>
            <div class="panel-body">
              <div class="hint" id="last-updated"></div>
              <div id="sections" class="faq-grid" style="margin-top: 8px;"></div>
              <div class="faq-actions">
                <button class="btn-secondary" type="button" id="add-section">Adicionar seção</button>
                <button class="btn-primary" type="submit">Salvar</button>
              </div>
            </div>
          </section>
        </form>

        <script>
          const initial = ${JSON.stringify(payload)};

          function escapeHtml(s) {
            return String(s || '')
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
          }

          function el(tag, attrs, html) {
            const n = document.createElement(tag);
            if (attrs) {
              Object.keys(attrs).forEach(k => {
                if (k === 'class') n.className = attrs[k];
                else if (k === 'text') n.textContent = attrs[k];
                else n.setAttribute(k, attrs[k]);
              });
            }
            if (html != null) n.innerHTML = html;
            return n;
          }

          const state = {
            updatedAt: initial.updatedAt || null,
            sections: Array.isArray(initial.sections) ? initial.sections.map(s => ({
              id: String(s.id || ''),
              title: String(s.title || ''),
              items: Array.isArray(s.items) ? s.items.map(i => ({ question: String(i.question || ''), answer: String(i.answer || '') })) : []
            })) : []
          };

          function render() {
            const container = document.getElementById('sections');
            container.innerHTML = '';

            const last = document.getElementById('last-updated');
            if (state.updatedAt) {
              try {
                const d = new Date(state.updatedAt);
                last.textContent = 'Última atualização: ' + d.toLocaleString('pt-BR');
              } catch {
                last.textContent = '';
              }
            } else {
              last.textContent = '';
            }

            state.sections.forEach((section, sectionIndex) => {
              const box = el('div', { class: 'faq-item' });
              const head = el('div', { class: 'faq-row' });
              head.appendChild(el('div', { class: 'form-group', style: 'margin-bottom:0;' },
                '<label>Título da seção</label>' +
                '<input type="text" value="' + escapeHtml(section.title) + '" data-section-title="' + sectionIndex + '" />'
              ));
              head.appendChild(el('div', { class: 'form-group', style: 'margin-bottom:0;' },
                '<label>Identificador (interno)</label>' +
                '<input type="text" value="' + escapeHtml(section.id) + '" data-section-id="' + sectionIndex + '" placeholder="ex.: faq" />'
              ));

              const headActions = el('div', { class: 'admin-actions', style: 'justify-content:center; margin-top: 8px;' });
              const addItemBtn = el('button', { type: 'button', class: 'btn-secondary', 'data-add-item': String(sectionIndex), text: 'Adicionar pergunta' });
              const delSectionBtn = el('button', { type: 'button', class: 'btn-secondary btn-danger', 'data-del-section': String(sectionIndex), text: 'Excluir seção' });
              headActions.appendChild(addItemBtn);
              headActions.appendChild(delSectionBtn);

              box.appendChild(head);
              box.appendChild(headActions);

              const itemsWrap = el('div', { style: 'margin-top: 10px; display:grid; gap:10px;' });
              section.items.forEach((item, itemIndex) => {
                const itemBox = el('div', { class: 'box' });
                itemBox.innerHTML =
                  '<div class="faq-row">' +
                    '<div class="form-group" style="margin-bottom:0;">' +
                      '<label>Pergunta</label>' +
                      '<input type="text" value="' + escapeHtml(item.question) + '" data-item-question="' + sectionIndex + ':' + itemIndex + '" />' +
                    '</div>' +
                    '<div class="form-group" style="margin-bottom:0;">' +
                      '<label>Resposta</label>' +
                      '<textarea data-item-answer="' + sectionIndex + ':' + itemIndex + '">' + escapeHtml(item.answer) + '</textarea>' +
                    '</div>' +
                    '<div class="admin-actions" style="justify-content:center;">' +
                      '<button type="button" class="btn-secondary btn-danger" data-del-item="' + sectionIndex + ':' + itemIndex + '">Excluir pergunta</button>' +
                    '</div>' +
                  '</div>';
                itemsWrap.appendChild(itemBox);
              });
              box.appendChild(itemsWrap);

              container.appendChild(box);
            });
          }

          function addSection() {
            state.sections.push({ id: 'faq', title: 'Perguntas frequentes (FAQ)', items: [] });
            render();
          }

          function addItem(sectionIndex) {
            const s = state.sections[sectionIndex];
            if (!s) return;
            s.items.push({ question: '', answer: '' });
            render();
          }

          function deleteSection(sectionIndex) {
            state.sections.splice(sectionIndex, 1);
            render();
          }

          function deleteItem(sectionIndex, itemIndex) {
            const s = state.sections[sectionIndex];
            if (!s) return;
            s.items.splice(itemIndex, 1);
            render();
          }

          document.addEventListener('click', (ev) => {
            const t = ev.target;
            if (!(t instanceof HTMLElement)) return;
            if (t.id === 'add-section') {
              ev.preventDefault();
              addSection();
              return;
            }
            if (t.dataset.addItem != null) {
              ev.preventDefault();
              addItem(Number(t.dataset.addItem));
              return;
            }
            if (t.dataset.delSection != null) {
              ev.preventDefault();
              if (!confirm('Excluir esta seção?')) return;
              deleteSection(Number(t.dataset.delSection));
              return;
            }
            if (t.dataset.delItem) {
              ev.preventDefault();
              if (!confirm('Excluir esta pergunta?')) return;
              const parts = String(t.dataset.delItem).split(':');
              deleteItem(Number(parts[0]), Number(parts[1]));
            }
          });

          document.addEventListener('input', (ev) => {
            const t = ev.target;
            if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;

            if (t.dataset.sectionTitle != null) {
              const idx = Number(t.dataset.sectionTitle);
              if (state.sections[idx]) state.sections[idx].title = t.value;
              return;
            }
            if (t.dataset.sectionId != null) {
              const idx = Number(t.dataset.sectionId);
              if (state.sections[idx]) state.sections[idx].id = t.value;
              return;
            }
            if (t.dataset.itemQuestion) {
              const parts = String(t.dataset.itemQuestion).split(':');
              const s = state.sections[Number(parts[0])];
              const it = s && s.items ? s.items[Number(parts[1])] : null;
              if (it) it.question = t.value;
              return;
            }
            if (t.dataset.itemAnswer) {
              const parts = String(t.dataset.itemAnswer).split(':');
              const s = state.sections[Number(parts[0])];
              const it = s && s.items ? s.items[Number(parts[1])] : null;
              if (it) it.answer = t.value;
            }
          });

          document.getElementById('faq-form').addEventListener('submit', () => {
            const clean = {
              updatedAt: state.updatedAt,
              sections: state.sections,
            };
            document.getElementById('payload').value = JSON.stringify(clean);
          });

          render();
        </script>
      </div>
    </body>
    </html>
  `;

  return res.type('html').send(html);
});

app.post(`/secret/${ADMIN_SECRET}/admin/faq`, checkAdminIP, adminAuth, (req, res) => {
  try {
    const payloadRaw = String(req.body?.payload || '').trim();
    if (!payloadRaw) return res.status(400).send('Payload vazio');

    let parsed;
    try {
      parsed = JSON.parse(payloadRaw);
    } catch {
      return res.status(400).send('JSON inválido');
    }

    const sectionsIn = Array.isArray(parsed?.sections) ? parsed.sections : [];
    const normalizedSections = sectionsIn
      .slice(0, 10)
      .map((s) => {
        const itemsIn = Array.isArray(s?.items) ? s.items : [];
        const id = String(s?.id || '').trim().slice(0, 40);
        const title = String(s?.title || '').trim().slice(0, 80);
        const items = itemsIn
          .slice(0, 50)
          .map((it) => {
            const question = String(it?.question || '').trim().slice(0, 200);
            const answer = String(it?.answer || '').trim().slice(0, 4000);
            return { question, answer };
          })
          .filter((it) => it.question && it.answer);
        return { id: id || 'faq', title: title || 'FAQ', items };
      })
      .filter((s) => s.items.length > 0);

    const nextFaq = {
      updatedAt: new Date().toISOString(),
      sections: normalizedSections,
    };

    faqRepo.save(nextFaq);
    try {
      logAdminAction('UPDATE_FAQ', getClientIP(req), { sections: normalizedSections.map(s => ({ id: s.id, items: s.items.length })) });
    } catch {
      // não bloqueia
    }

    return res.redirect(`/secret/${ADMIN_SECRET}/admin/faq?saved=1`);
  } catch (err) {
    return res.status(500).send('Falha ao salvar FAQ');
  }
});

// Alternar confirmação de presença
app.post(`/secret/${ADMIN_SECRET}/admin/events/:id/registrations/:index/toggle-confirm`, checkAdminIP, adminAuth, async (req, res) => {
    const event = await eventRepo.findById(req.params.id);
    if (!event) return res.status(404).send('Evento não encontrado');
    
    const idx = Number(req.params.index);
    if (!event.registrations[idx]) return res.status(404).send('Inscrição não encontrada');
    
    event.registrations[idx].confirmed = !event.registrations[idx].confirmed;
    await eventRepo.save(event);
    
    res.redirect(`/secret/${ADMIN_SECRET}/admin/events/${event.id}/registrations`);
});

// Visualizar inscritos de um evento
app.get(`/secret/${ADMIN_SECRET}/admin/events/:id/registrations`, checkAdminIP, adminAuth, async (req, res) => {
    const event = await eventRepo.findById(req.params.id);
    if (!event) return res.status(404).send('Evento não encontrado');
    
    const registrationsHtml = (event.registrations || []).map((r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(r.nome)}</td>
        <td>${escapeHtml(r.cpf)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.role || event.participantRole || 'PARTICIPANTE')}</td>
        <td>${new Date(r.registeredAt).toLocaleDateString('pt-BR')}</td>
        <td style="text-align:center;">
            <form method="POST" action="/secret/${ADMIN_SECRET}/admin/events/${event.id}/registrations/${idx}/toggle-confirm" style="display:inline;">
                <button type="submit" class="btn-secondary" style="padding: 4px 8px; font-size: 0.8em; background-color: ${r.confirmed ? '#2e7d32' : '#ccc'}; color: ${r.confirmed ? 'white' : 'black'}; border:none; cursor:pointer;">
                    ${r.confirmed ? 'Sim' : 'Não'}
                </button>
            </form>
        </td>
        <td>
          <form method="POST" action="/secret/${ADMIN_SECRET}/admin/events/${event.id}/certificate/${idx}" target="_blank" style="display:inline;">
            <button class="btn-primary" type="submit">Gerar Certificado</button>
          </form>
        </td>
      </tr>
    `).join('');
    
    res.send(`
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Inscritos - ${escapeHtml(event.title)}</title>
        <link rel="stylesheet" href="/theme.css" />
      </head>
      <body>
        <div class="container">
          <header class="main-header">
            <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
              <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
              <h1>Inscritos no Evento</h1>
              <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
            </div>
          </header>

          ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'events' })}
          <section class="panel">
            <div class="panel-header"><h2>${escapeHtml(event.title)}</h2></div>
            <div class="panel-body">
              <p><strong>Data:</strong> ${new Date(event.date).toLocaleDateString('pt-BR')}</p>
              <p><strong>Local:</strong> ${escapeHtml(event.location)}</p>
              <p><strong>Carga Horária:</strong> ${escapeHtml(event.workload)}</p>
              <p><strong>Total de Inscritos:</strong> ${event.registrations.length}</p>

              <table class="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Email</th>
                    <th>Função</th>
                    <th>Data de Inscrição</th>
                    <th style="text-align:center;">Presença</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${registrationsHtml || '<tr><td colspan="8" style="text-align:center;">Nenhum inscrito</td></tr>'}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </body>
      </html>
    `);
});

// Gerar certificado para um inscrito
app.post(`/secret/${ADMIN_SECRET}/admin/events/:id/certificate/:index`, checkAdminIP, adminAuth, async (req, res) => {
    try {
      const event = await eventRepo.findById(req.params.id);
      if (!event) return res.status(404).send('Evento não encontrado');

      const index = parseInt(req.params.index);
      const registration = event.registrations[index];
      if (!registration) return res.status(404).send('Inscrição não encontrada');

      const auditInfo = {
        ip: getClientIP(req),
        user: { username: req.session.user || 'admin' },
        createdAt: new Date(),
      };

      const pdfBuffer = await pdfService.generateCertificatePdf(
        {
          nome: registration.nome,
          cpf: registration.cpf,
          curso: event.title,
          data: new Date(event.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
          cargaHoraria: event.workload,
          coordinator: event.coordinator,
          department: event.department,
          speakers: event.speakers,
          role: registration.role || event.participantRole || 'PARTICIPANTE',
          syllabus: event.syllabus,
          activities: event.activities,
          textoLivre: '',
        },
        auditInfo
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="certificado-${registration.nome.replace(/\s+/g, '_')}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      console.error('Erro ao gerar certificado:', err);
      return res.status(500).send('Erro ao gerar certificado');
    }
});

app.get(`/secret/${ADMIN_SECRET}/admin/appeals`, checkAdminIP, adminAuth, async (req, res) => {
  return adminController.appeals(req, res);
});

// Atualizar calendário de inscrições (admin)
app.post(`/secret/${ADMIN_SECRET}/admin/registration-window`, checkAdminIP, adminAuth, (req, res) => {
  try {
    const start = String(req.body?.start || '').trim();
    const end = String(req.body?.end || '').trim();
    const rw = storage.setRegistrationWindow({ startDateStr: start, endDateStr: end });

    // Mantém o novo calendário (edital/ano) em sincronia com o formulário legado
    try {
      const year = new Date().getFullYear();
      if (rw?.startISO && rw?.endISO && typeof calendarRepo.updatePhaseWindow === 'function') {
        calendarRepo.updatePhaseWindow(year, PHASE.INSCRICAO, { startISO: rw.startISO, endISO: rw.endISO });
      }
    } catch (syncErr) {
      console.error('Falha ao sincronizar calendário do edital', syncErr);
    }

    logAdminAction('SET_REGISTRATION_WINDOW', getClientIP(req), { startISO: rw.startISO, endISO: rw.endISO });
    return res.redirect(`/secret/${ADMIN_SECRET}/admin`);
  } catch (err) {
    logAdminAction('SET_REGISTRATION_WINDOW_FAILED', getClientIP(req), { error: String(err && err.message || err) });
    return res.status(500).send('Falha ao salvar calendário de inscrições');
  }
});

// Committee evaluation pages and API
app.get(`/secret/${ADMIN_SECRET}/committee`, checkAdminIP, adminAuth, async (req, res) => {
  const subs = await Promise.resolve(submissionRepo.findAll());
  const evals = await Promise.resolve(evaluationRepo.getAll());
  const evalMap = new Map(evals.map(e => [e.protocol, e]));

  // Pesos provisórios do edital: Projeto=4, Entrevista=5, Língua=1
  const WEIGHTS = { project: 4, interview: 5, language: 1 };
  const MAX = { project: 10, interview: 10, language: 10 }; // normalização por máximos

  function score(protocol) {
    const e = evalMap.get(protocol);
    if (!e) return { total: '', status: '—', components: {} };
    // Usar totais detalhados, se existirem
    const proj = Number(e.proj_total || 0);
    const intr = Number(e.int_total || 0);
    const lang = Number(e.lang_total || 0);
    const projNorm = Math.max(0, Math.min(1, proj / MAX.project));
    const intrNorm = Math.max(0, Math.min(1, intr / MAX.interview));
    const langNorm = Math.max(0, Math.min(1, lang / MAX.language));
    const weighted = (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
    const status = e.eliminado ? 'Eliminado' : 'Classificável';
    return { total: weighted.toFixed(2), status, components: { proj, intr, lang } };
  }

  const subsLine1 = subs.filter(s => (s.project?.area || '').includes('Linha de Pesquisa 1'));
  const subsLine2 = subs.filter(s => (s.project?.area || '').includes('Linha de Pesquisa 2'));
  const subsOther = subs.filter(s => !(s.project?.area || '').includes('Linha de Pesquisa 1') && !(s.project?.area || '').includes('Linha de Pesquisa 2'));

  function renderRows(list) {
    if (!list.length) return '<tr><td colspan="8">Nenhum projeto nesta linha.</td></tr>';
    return list.map(s => {
      const e = evalMap.get(s.protocol);
      const sc = score(s.protocol);
      return `
        <tr>
          <td>${escapeHtml(s.protocol)}</td>
          <td>${escapeHtml((s.project?.titulo_pt || '').slice(0, 80))}</td>
          <td>${e ? escapeHtml(String(e.proj_total ?? '')) : ''}</td>
          <td>${e ? escapeHtml(String(e.int_total ?? '')) : ''}</td>
          <td>${e ? escapeHtml(String(e.lang_total ?? '')) : ''}</td>
          <td>${escapeHtml(sc.total)}</td>
          <td>${escapeHtml(sc.status)}</td>
          <td><a class="btn-secondary" href="/secret/${ADMIN_SECRET}/committee/evaluate/${encodeURIComponent(s.protocol)}">Avaliar</a></td>
        </tr>
      `;
    }).join('');
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Comissão - Avaliações</title>
      <link rel="stylesheet" href="/theme.css" />
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            <h1>Comissão - Avaliações</h1>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'committee' })}
        
        <section class="panel">
          <div class="panel-header"><h2>Linha 1 – Planejamento Urbano-regional, Ambiental e de Comunidades Tradicionais</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Projeto (0–10)</th><th>Entrevista (0–10)</th><th>Língua (0–10)</th><th>Total (P=4/E=5/L=1)</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(subsLine1)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2>Linha 2 – Políticas públicas, Planejamento Territorial e Participação Social</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Projeto (0–10)</th><th>Entrevista (0–10)</th><th>Língua (0–10)</th><th>Total (P=4/E=5/L=1)</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(subsLine2)}
              </tbody>
            </table>
          </div>
        </section>

        ${subsOther.length ? `
        <section class="panel">
          <div class="panel-header"><h2>Outros / Não classificados</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Projeto (0–10)</th><th>Entrevista (0–10)</th><th>Língua (0–10)</th><th>Total (P=4/E=5/L=1)</th><th>Status</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(subsOther)}
              </tbody>
            </table>
          </div>
        </section>` : ''}
      </div>
    </body>
    </html>
  `);
});

// Página de resultados com ranking
app.get(`/secret/${ADMIN_SECRET}/committee/results`, checkAdminIP, adminAuth, async (req, res) => {
  const subs = await Promise.resolve(submissionRepo.findAll());
  const evals = await Promise.resolve(evaluationRepo.getAll());
  const evalMap = new Map(evals.map(e => [e.protocol, e]));
  const WEIGHTS = { project: 4, interview: 5, language: 1 };
  const MAX = { project: 10, interview: 10, language: 10 };

  function totalScore(e) {
    if (!e) return 0;
    const projNorm = Math.max(0, Math.min(1, Number(e.proj_total || 0) / MAX.project));
    const intrNorm = Math.max(0, Math.min(1, Number(e.int_total || 0) / MAX.interview));
    const langNorm = Math.max(0, Math.min(1, Number(e.lang_total || 0) / MAX.language));
    return (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
  }

  const rowsData = subs.map(s => {
    const e = evalMap.get(s.protocol);
    return {
      protocol: s.protocol,
      nome: s.identified?.nome || '',
      titulo: s.project?.titulo_pt || '',
      area: s.project?.area || '',
      proj: e?.proj_total ?? '',
      intr: e?.int_total ?? '',
      lang: e?.lang_total ?? '',
      total: totalScore(e),
      eliminado: e?.eliminado ? 'Sim' : 'Não',
      reserva: s.identified?.cotas || '',
    };
  }).sort((a, b) => b.total - a.total);

  const rowsLine1 = rowsData.filter(r => r.area.includes('Linha de Pesquisa 1'));
  const rowsLine2 = rowsData.filter(r => r.area.includes('Linha de Pesquisa 2'));
  const rowsOther = rowsData.filter(r => !r.area.includes('Linha de Pesquisa 1') && !r.area.includes('Linha de Pesquisa 2'));

  function renderRankingRows(list) {
    if (!list.length) return '<tr><td colspan="8">Nenhum resultado.</td></tr>';
    return list.map(r => `
      <tr>
        <td>${escapeHtml(r.protocol)}</td>
        <td>${escapeHtml(r.titulo.slice(0, 80))}</td>
        <td>${escapeHtml(String(r.proj))}</td>
        <td>${escapeHtml(String(r.intr))}</td>
        <td>${escapeHtml(String(r.lang))}</td>
        <td>${escapeHtml(r.total.toFixed(2))}</td>
        <td>${escapeHtml(r.eliminado)}</td>
        <td>${escapeHtml(r.reserva)}</td>
      </tr>
    `).join('');
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Comissão - Resultados</title>
      <link rel="stylesheet" href="/theme.css" />
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            <h1>Resultados (Ranking)</h1>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'results' })}
        <div class="admin-actions" style="justify-content:center; gap:8px; margin-bottom:10px;">
          <a class="btn-secondary" href="/secret/${ADMIN_SECRET}/committee/results/csv">Baixar CSV</a>
          <button class="btn-secondary" type="button" id="btn-print-ranking">Imprimir / PDF</button>
          <span class="admin-badge">Pesos: Projeto=4, Entrevista=5, Língua=1 (normalizados)</span>
        </div>

        <section class="panel">
          <div class="panel-header"><h2>Linha 1 – Planejamento Urbano-regional, Ambiental e de Comunidades Tradicionais</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Proj (0–10)</th><th>Ent (0–10)</th><th>Língua (0–10)</th><th>Total</th><th>Eliminado</th><th>Vagas Reservadas</th>
                </tr>
              </thead>
              <tbody>
                ${renderRankingRows(rowsLine1)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header"><h2>Linha 2 – Políticas públicas, Planejamento Territorial e Participação Social</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Proj (0–10)</th><th>Ent (0–10)</th><th>Língua (0–10)</th><th>Total</th><th>Eliminado</th><th>Vagas Reservadas</th>
                </tr>
              </thead>
              <tbody>
                ${renderRankingRows(rowsLine2)}
              </tbody>
            </table>
          </div>
        </section>

        ${rowsOther.length ? `
        <section class="panel">
          <div class="panel-header"><h2>Outros</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th><th>Título</th><th>Proj (0–10)</th><th>Ent (0–10)</th><th>Língua (0–10)</th><th>Total</th><th>Eliminado</th><th>Vagas Reservadas</th>
                </tr>
              </thead>
              <tbody>
                ${renderRankingRows(rowsOther)}
              </tbody>
            </table>
          </div>
        </section>` : ''}
      </div>
      <script>
        document.getElementById('btn-print-ranking').addEventListener('click', function() {
          window.print();
        });
      </script>
      <style>
        @media print {
          .admin-actions, .main-header { display: none !important; }
          .container { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; }
          .panel { box-shadow: none !important; border: 1px solid #ddd !important; break-inside: avoid; }
        }
      </style>
    </body>
    </html>
  `);
});

// Exportar Ranking CSV
app.get(`/secret/${ADMIN_SECRET}/committee/results/csv`, checkAdminIP, adminAuth, async (req, res) => {
  const subs = await Promise.resolve(submissionRepo.findAll());
  const evals = await Promise.resolve(evaluationRepo.getAll());
  const evalMap = new Map(evals.map(e => [e.protocol, e]));
  const WEIGHTS = { project: 4, interview: 5, language: 1 };
  const MAX = { project: 10, interview: 10, language: 10 };

  function totalScore(e) {
    if (!e) return 0;
    const projNorm = Math.max(0, Math.min(1, Number(e.proj_total || 0) / MAX.project));
    const intrNorm = Math.max(0, Math.min(1, Number(e.int_total || 0) / MAX.interview));
    const langNorm = Math.max(0, Math.min(1, Number(e.lang_total || 0) / MAX.language));
    return (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
  }

  const rowsData = subs.map(s => {
    const e = evalMap.get(s.protocol);
    return {
      protocol: s.protocol,
      nome: s.identified?.nome || '',
      titulo: s.project?.titulo_pt || '',
      area: s.project?.area || '',
      proj: e?.proj_total ?? '',
      intr: e?.int_total ?? '',
      lang: e?.lang_total ?? '',
      total: totalScore(e),
      eliminado: e?.eliminado ? 'Sim' : 'Não',
      reserva: s.identified?.cotas || '',
    };
  }).sort((a, b) => b.total - a.total);

  const header = ['Protocolo', 'Nome', 'Título', 'Área', 'Nota Projeto', 'Nota Entrevista', 'Nota Língua', 'Total Ponderado', 'Eliminado', 'Cotas'].join(';');
  
  const csvEscape = (field) => {
    if (field == null) return '';
    const s = String(field).replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines = rowsData.map(r => {
    return [
      r.protocol,
      r.nome,
      r.titulo,
      r.area,
      String(r.proj),
      String(r.intr),
      String(r.lang),
      r.total.toFixed(2),
      r.eliminado,
      r.reserva
    ].map(csvEscape).join(';');
  });

  // Adiciona BOM (\uFEFF) para forçar Excel a reconhecer UTF-8
  const csv = '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n';
  const filename = `ranking_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csv);
});

app.get(`/secret/${ADMIN_SECRET}/committee/evaluate/:protocol`, checkAdminIP, adminAuth, async (req, res) => {
  const protocol = req.params.protocol;
  const s = await Promise.resolve(submissionRepo.findByProtocol(protocol));
  if (!s) return res.status(404).send('Não encontrado');
  const eRaw = await Promise.resolve(evaluationRepo.findByProtocol(protocol));
  const e = normalizeEvaluationRecord(eRaw || {});

  const secretPrefix = `/secret/${ADMIN_SECRET}`;
  let backHref = `${secretPrefix}/committee`;

  // Permite voltar para a tela do avaliador quando esta página for acessada a partir dela.
  // (fallback seguro: sempre dentro do mesmo /secret)
  const explicitFrom = String(req.query.from || '');
  const explicitLine = String(req.query.line || '');
  const explicitNum = String(req.query.num || '');
  if (explicitFrom === 'evaluator' && explicitLine && explicitNum) {
    backHref = `${secretPrefix}/evaluator/${encodeURIComponent(explicitLine)}/${encodeURIComponent(explicitNum)}`;
  } else {
    const referer = req.get('referer');
    if (referer) {
      try {
        const refUrl = new URL(referer);
        const evaluatorPrefix = `${secretPrefix}/evaluator/`;
        if (refUrl.pathname.startsWith(evaluatorPrefix)) {
          const rest = refUrl.pathname.slice(evaluatorPrefix.length);
          const [line, num] = rest.split('/');
          if (line && num) backHref = `${secretPrefix}/evaluator/${encodeURIComponent(line)}/${encodeURIComponent(num)}`;
        }
      } catch {
        // ignore invalid/missing referrer URL
      }
    }
  }

  // Projeto rubric max values
  const projectRubric = [
    { key: 'proj_intro', label: '1 – Introdução / Contextualização', max: 1 },
    { key: 'proj_problem', label: '2 – Problema ou questão de pesquisa', max: 1.5 },
    { key: 'proj_just', label: '3 – Justificativa (relevância e viabilidade)', max: 1 },
    { key: 'proj_objectives', label: '4 – Objetivos (geral e específicos)', max: 2 },
    { key: 'proj_review', label: '5 – Revisão da literatura', max: 1 },
    { key: 'proj_methods', label: '6 – Procedimentos metodológicos', max: 2.5 },
    { key: 'proj_schedule', label: '7 – Cronograma (2 anos)', max: 0.5 },
    { key: 'proj_refs', label: '8 – Referências (ABNT)', max: 0.5 },
  ];

  // Pesos e máximos para cálculo da nota final (usar mesma lógica do resto do app)
  const WEIGHTS = { project: 4, interview: 5, language: 1 };
  const MAX = { project: 10, interview: 10, language: 10 };

  // Calcular nota final atual (se houver avaliações)
  let finalScoreDisplay = '';
  if (e) {
    const projTotal = e.proj_total != null ? Number(e.proj_total) : 0;
    const intTotal = e.int_total != null ? Number(e.int_total) : 0;
    const langTotal = e.lang_total != null ? Number(e.lang_total) : 0;
    const projNorm = Math.max(0, Math.min(1, projTotal / MAX.project));
    const intNorm = Math.max(0, Math.min(1, intTotal / MAX.interview));
    const langNorm = Math.max(0, Math.min(1, langTotal / MAX.language));
    const finalScore = (projNorm * WEIGHTS.project) + (intNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
    finalScoreDisplay = Number.isFinite(finalScore) ? finalScore.toFixed(2) : '';
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Avaliação - ${escapeHtml(protocol)}</title>
      <link rel="stylesheet" href="/theme.css" />
      <style>
        .eval-input {
          width: 100%;
          padding: 6px;
          border: 1px solid #86A3C2;
          border-radius: 4px;
          box-sizing: border-box;
          font-size: 12px;
          background: #fff;
        }

        .panel-body input[type="number"],
        .panel-body input[type="text"],
        .panel-body textarea,
        .panel-body select {
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            <h1>Avaliação de Projeto</h1>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'committee' })}
        <div class="admin-actions" style="justify-content:center; gap:8px;">
          <a class="btn-secondary" href="${backHref}">← Voltar</a>
          <span class="admin-badge">Protocolo: ${escapeHtml(protocol)}</span>
        </div>
        <section class="panel">
          <div class="panel-header"><h2>Ficha</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <div><strong>Inscrição:</strong> ${escapeHtml(protocol)}</div>
            <div style="margin-top:6px;"><strong>Título:</strong> ${escapeHtml(s.project?.titulo_pt || '')}</div>
            <div><strong>Linha:</strong> ${escapeHtml(s.project?.area || '')}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-header"><h2>Avaliação</h2></div>
          <div class="panel-body">
            <form method="POST" action="/secret/${ADMIN_SECRET}/committee/evaluate/${encodeURIComponent(protocol)}">
              <h3 style="color:#003366;">Projeto (3 Avaliadores)</h3>
              <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                ${[{key:'avaliador1',label:'Avaliador 1'},{key:'avaliador2',label:'Avaliador 2'},{key:'avaliador3',label:'Comissão'}].map(ev => {
                  const prefix = `proj_${ev.key}`;
                  return `
                    <div class="box">
                      <div style="font-weight:bold; color:#003366; margin-bottom:6px;">${ev.label}</div>
                      ${projectRubric.map(item => {
                        const key = `${prefix}_${item.key}`;
                        const val = e[key] ?? '';
                        return `
                          <div class="form-group" style="margin-bottom:4px;">
                            <label for="${key}">${escapeHtml(item.label)} (máx. ${item.max})</label>
                            <input type="number" id="${key}" name="${key}" min="0" max="${item.max}" step="0.1" value="${escapeHtml(String(val))}" class="eval-input proj-input" />
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `;
                }).join('')}
              </div>


              <div class="form-group" style="margin-top:8px;">
                <label for="proj_potential_interview">O(a) candidato(a) tem potencial e deve passar para a fase da entrevista?</label>
                <select class="eval-input" id="proj_potential_interview" name="proj_potential_interview">
                  ${['','Sim','Não'].map(opt => {
                    const sel = String(e.proj_potential_interview || '') === opt ? 'selected' : '';
                    return `<option value="${escapeHtml(opt)}" ${sel}>${escapeHtml(opt||'Selecione…')}</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="proj_justification">Justifique (pontos fortes e fracos do projeto)</label>
                <textarea class="eval-input" id="proj_justification" name="proj_justification" rows="4">${escapeHtml(String(e.proj_justification || ''))}</textarea>
              </div>
              <div class="form-group">
                <label for="proj_interview_points">Aspectos a questionar na entrevista</label>
                <textarea class="eval-input" id="proj_interview_points" name="proj_interview_points" rows="3">${escapeHtml(String(e.proj_interview_points || ''))}</textarea>
              </div>

              <h3 style="color:#003366; margin-top:12px;">Entrevista (3 Avaliadores)</h3>
              <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                ${[{key:'avaliador1',label:'Avaliador 1'},{key:'avaliador2',label:'Avaliador 2'},{key:'avaliador3',label:'Comissão'}].map((ev) => {
                  const prefix = `int_${ev.key}`;
                  const ap = e[`${prefix}_apresentacao`] ?? '';
                  const hp = e[`${prefix}_historico`] ?? '';
                  const df = e[`${prefix}_defesa`] ?? '';
                  const ji = e[`${prefix}_justificativa`] ?? '';
                  return `
                    <div class="box">
                      <div style="font-weight:bold; color:#003366;">${ev.label}</div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_apresentacao">Apresentação (máx. 3)</label>
                        <input type="number" id="${prefix}_apresentacao" name="${prefix}_apresentacao" min="0" max="3" step="0.1" value="${escapeHtml(String(ap))}" class="eval-input int-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_historico">Histórico Profissional (máx. 2)</label>
                        <input type="number" id="${prefix}_historico" name="${prefix}_historico" min="0" max="2" step="0.1" value="${escapeHtml(String(hp))}" class="eval-input int-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_defesa">Defesa da proposta (máx. 3)</label>
                        <input type="number" id="${prefix}_defesa" name="${prefix}_defesa" min="0" max="3" step="0.1" value="${escapeHtml(String(df))}" class="eval-input int-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_justificativa">Justificativa/interesse + disponibilidade (máx. 2)</label>
                        <input type="number" id="${prefix}_justificativa" name="${prefix}_justificativa" min="0" max="2" step="0.1" value="${escapeHtml(String(ji))}" class="eval-input int-input" />
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>

              <h3 style="color:#003366; margin-top:12px;">Prova de Língua (3 Avaliadores)</h3>
              <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                ${[{key:'avaliador1',label:'Avaliador 1'},{key:'avaliador2',label:'Avaliador 2'},{key:'avaliador3',label:'Comissão'}].map(ev => {
                  const prefix = `lang_${ev.key}`;
                  const c = e[`${prefix}_clareza`] ?? '';
                  const d = e[`${prefix}_domino`] ?? '';
                  const a = e[`${prefix}_analise`] ?? '';
                  return `
                    <div class="box">
                      <div style="font-weight:bold; color:#003366;">${ev.label}</div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_clareza">Clareza e Coesão (0-10)</label>
                        <input type="number" id="${prefix}_clareza" name="${prefix}_clareza" min="0" max="10" step="0.1" value="${escapeHtml(String(c))}" class="eval-input lang-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_domino">Domínio do Conteúdo (0-10)</label>
                        <input type="number" id="${prefix}_domino" name="${prefix}_domino" min="0" max="10" step="0.1" value="${escapeHtml(String(d))}" class="eval-input lang-input" />
                      </div>
                      <div class="form-group" style="margin-bottom:4px;">
                        <label for="${prefix}_analise">Análise Crítica (0-10)</label>
                        <input type="number" id="${prefix}_analise" name="${prefix}_analise" min="0" max="10" step="0.1" value="${escapeHtml(String(a))}" class="eval-input lang-input" />
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
              <div class="hint" style="margin-top:6px;">Total da prova (por avaliador) = (Clareza*0,3) + (Domínio*0,4) + (Análise*0,3)</div>
              <div class="form-group">
                <label for="nota_projeto">Nota do Projeto (0-10) - Média</label>
                <input class="eval-input" type="number" id="nota_projeto" name="nota_projeto" min="0" max="10" step="0.1" readonly style="background-color:#eee;" value="${escapeHtml(String(e.nota_projeto || ''))}" />
              </div>
              <div class="form-group">
                <label for="nota_entrevista">Nota da Entrevista (0-10) - Média</label>
                <input class="eval-input" type="number" id="nota_entrevista" name="nota_entrevista" min="0" max="10" step="0.1" readonly style="background-color:#eee;" value="${escapeHtml(String(e.nota_entrevista || ''))}" />
              </div>
              <div class="form-group" style="margin-top:8px;">
                <label for="lang_total_calc">Nota da Prova de Língua (0-10) - Média</label>
                <input class="eval-input" type="text" id="lang_total_calc" readonly style="background-color:#eee;" value="${escapeHtml(String(e.lang_total ? e.lang_total.toFixed(2) : ''))}" />
              </div>
              <div class="form-group" style="margin-top:8px;">
                <label for="nota_final">Nota Final (P=4, E=5, L=1)</label>
                <input class="eval-input" type="text" id="nota_final" readonly style="background-color:#eee; font-weight:bold;" value="${escapeHtml(String(finalScoreDisplay))}" />
              </div>
              <div class="form-group">
                <label for="eliminado">Eliminação (Casos omissos)</label>
                <select class="eval-input" id="eliminado" name="eliminado">
                  ${['Não','Sim'].map(opt => {
                    const sel = String(e.eliminado ? 'Sim' : 'Não') === opt ? 'selected' : '';
                    return `<option value="${escapeHtml(opt)}" ${sel}>${escapeHtml(opt)}</option>`;
                  }).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="observacoes">Observações</label>
                <textarea class="eval-input" id="observacoes" name="observacoes" rows="4">${escapeHtml(String(e.observacoes || ''))}</textarea>
              </div>
              <div class="admin-actions" style="justify-content:center;">
                <button class="btn-primary" type="submit">Salvar avaliação</button>
              </div>
            </form>
          </div>
        </section>
      </div>
      <script>
        (function() {
          // Project and interview: compute per-evaluator sums and average only evaluators that have values
          const projPrefixes = ['proj_avaliador1','proj_avaliador2','proj_avaliador3'];
          const intPrefixes = ['int_avaliador1','int_avaliador2','int_avaliador3'];
          const notaProjeto = document.getElementById('nota_projeto');
          const notaEntrevista = document.getElementById('nota_entrevista');
          const langPrefixes = ['lang_avaliador1','lang_avaliador2','lang_avaliador3'];
          const langTotalCalc = document.getElementById('lang_total_calc');

          function calcProject() {
            let total = 0;
            let count = 0;
            projPrefixes.forEach(p => {
              const elems = Array.from(document.querySelectorAll('[id^="' + p + '_"]'));
              const sum = elems.reduce((s, el) => s + (parseFloat(el.value) || 0), 0);
              const anyFilled = elems.some(el => String(el.value || '').trim() !== '');
              if (anyFilled) { total += sum; count += 1; }
            });
            const avg = count > 0 ? (total / count) : 0;
            if (notaProjeto) notaProjeto.value = count > 0 ? avg.toFixed(2) : '';
          }

          function calcInterview() {
            let total = 0;
            let count = 0;
            intPrefixes.forEach(p => {
              const elems = Array.from(document.querySelectorAll('[id^="' + p + '_"]'));
              const sum = elems.reduce((s, el) => s + (parseFloat(el.value) || 0), 0);
              const anyFilled = elems.some(el => String(el.value || '').trim() !== '');
              if (anyFilled) { total += sum; count += 1; }
            });
            const avg = count > 0 ? (total / count) : 0;
            if (notaEntrevista) notaEntrevista.value = count > 0 ? avg.toFixed(2) : '';
          }

          function calcLanguage() {
            let total = 0;
            let count = 0;
            langPrefixes.forEach(p => {
              const cEl = document.getElementById(p + '_clareza');
              const dEl = document.getElementById(p + '_domino');
              const aEl = document.getElementById(p + '_analise');
              const anyFilled = [cEl, dEl, aEl].some(el => el && String(el.value || '').trim() !== '');
              const c = cEl ? (parseFloat(cEl.value) || 0) : 0;
              const d = dEl ? (parseFloat(dEl.value) || 0) : 0;
              const a = aEl ? (parseFloat(aEl.value) || 0) : 0;
              const sum = (c * 0.3) + (d * 0.4) + (a * 0.3);
              if (anyFilled) { total += sum; count += 1; }
            });
            const avg = count > 0 ? (total / count) : 0;
            if (langTotalCalc) langTotalCalc.value = count > 0 ? avg.toFixed(2) : '';
          }

          // Attach listeners for dynamic calculation
          projPrefixes.forEach(p => {
            Array.from(document.querySelectorAll('[id^="' + p + '_"]')).forEach(el => el.addEventListener('input', calcProject));
          });
          intPrefixes.forEach(p => {
            Array.from(document.querySelectorAll('[id^="' + p + '_"]')).forEach(el => el.addEventListener('input', calcInterview));
          });
          langPrefixes.forEach(p => {
            ['_clareza','_domino','_analise'].forEach(suffix => {
              const el = document.getElementById(p + suffix);
              if (el) el.addEventListener('input', calcLanguage);
            });
          });

          // Initial calc on load
          calcProject();
          calcInterview();
          calcLanguage();
        })();
      </script>
    </body>
    </html>
  `);
});

app.post(`/secret/${ADMIN_SECRET}/committee/evaluate/:protocol`, checkAdminIP, adminAuth, async (req, res) => {
  const protocol = req.params.protocol;
  const s = await Promise.resolve(submissionRepo.findByProtocol(protocol));
  if (!s) return res.status(404).send('Não encontrado');

  const now = new Date();

  const parseOptionalNumber = (raw) => {
    const text = String(raw ?? '').trim();
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  };

  const evaluators = ['avaliador1','avaliador2','avaliador3'];

  // Projeto: 3 avaliadores, cada um com 8 itens
  const projectKeys = ['proj_intro','proj_problem','proj_just','proj_objectives','proj_review','proj_methods','proj_schedule','proj_refs'];
  const projectScores = {};
  let projTotalSum = 0;
  let projCount = 0;
  
  evaluators.forEach(who => {
    let sumEv = 0;
    let anyFilled = false;
    projectKeys.forEach(k => {
      const key = `proj_${who}_${k}`;
      const raw = req.body?.[key];
      const v = parseOptionalNumber(raw);
      if (v !== null) anyFilled = true;
      projectScores[key] = v;
      sumEv += (v ?? 0);
    });
    if (anyFilled) {
      projTotalSum += sumEv;
      projCount += 1;
    }
  });
  const projTotal = projCount > 0 ? (projTotalSum / projCount) : 0;

  // Entrevista: 3 avaliadores, cada com 4 itens
  const interviewScores = {};
  let intTotalSum = 0;
  let intCount = 0;
  evaluators.forEach(who => {
    const prefix = `int_${who}`;
    const apRaw = req.body?.[`${prefix}_apresentacao`];
    const hpRaw = req.body?.[`${prefix}_historico`];
    const dfRaw = req.body?.[`${prefix}_defesa`];
    const jiRaw = req.body?.[`${prefix}_justificativa`];
    const ap = parseOptionalNumber(apRaw);
    const hp = parseOptionalNumber(hpRaw);
    const df = parseOptionalNumber(dfRaw);
    const ji = parseOptionalNumber(jiRaw);
    const anyFilled = [ap, hp, df, ji].some(v => v !== null);
    interviewScores[`${prefix}_apresentacao`] = ap;
    interviewScores[`${prefix}_historico`] = hp;
    interviewScores[`${prefix}_defesa`] = df;
    interviewScores[`${prefix}_justificativa`] = ji;
    if (anyFilled) {
      intTotalSum += ((ap ?? 0) + (hp ?? 0) + (df ?? 0) + (ji ?? 0));
      intCount += 1;
    }
  });
  const intTotal = intCount > 0 ? (intTotalSum / intCount) : 0;

  const proj_possible_supervisor = String(req.body?.proj_possible_supervisor || '');
  const proj_potential_interview = String(req.body?.proj_potential_interview || '');
  const proj_justification = String(req.body?.proj_justification || '').slice(0, 4000);
  const proj_interview_points = String(req.body?.proj_interview_points || '').slice(0, 4000);

  const eliminado = String(req.body?.eliminado || 'Não') === 'Sim';
  const observacoes = String(req.body?.observacoes || '').slice(0, 2000);

  // Prova de língua: 3 avaliadores
  const langScores = {};
  let langTotalSum = 0;
  let langCount = 0;
  evaluators.forEach(who => {
    const prefix = `lang_${who}`;
    const cRaw = req.body?.[`${prefix}_clareza`];
    const dRaw = req.body?.[`${prefix}_domino`];
    const aRaw = req.body?.[`${prefix}_analise`];
    const c = parseOptionalNumber(cRaw);
    const d = parseOptionalNumber(dRaw);
    const a = parseOptionalNumber(aRaw);
    const anyFilled = [c, d, a].some(v => v !== null);
    langScores[`${prefix}_clareza`] = c;
    langScores[`${prefix}_domino`] = d;
    langScores[`${prefix}_analise`] = a;
    // Weighted sum per evaluator
    if (anyFilled) {
      langTotalSum += (((c ?? 0) * 0.3) + ((d ?? 0) * 0.4) + ((a ?? 0) * 0.3));
      langCount += 1;
    }
  });
  const lang_total = langCount > 0 ? (langTotalSum / langCount) : 0;

  // Workflow gating: só avalia dentro do prazo e respeitando aprovação na fase anterior
  try {
    if (projCount > 0) await workflowService.assertCanEvaluatePhase({ submissionProtocol: protocol, phaseKey: PHASE.PROJETO, now });
    if (intCount > 0) await workflowService.assertCanEvaluatePhase({ submissionProtocol: protocol, phaseKey: PHASE.ENTREVISTA, now });
    if (langCount > 0) await workflowService.assertCanEvaluatePhase({ submissionProtocol: protocol, phaseKey: PHASE.LINGUA, now });
  } catch (err) {
    return res.status(403).send(err.message || 'Avaliação bloqueada pelo workflow');
  }

  await Promise.resolve(evaluationRepo.save({
    protocol,
    projectScores,
    proj_total: projTotal,
    proj_possible_supervisor,
    proj_potential_interview,
    proj_justification,
    proj_interview_points,
    interviewScores,
    int_total: intTotal,
    languageScores: langScores,
    lang_total,
    eliminado,
    observacoes,
    updatedAt: new Date().toISOString(),
  }));

  // Se eliminado, a inscrição passa a indeferida e o candidato não segue
  if (eliminado) {
    s.status = 'Indeferido';
    s.adminUpdatedAt = new Date().toISOString();
    await Promise.resolve(submissionRepo.save(s));
  }

  // Atualiza status por fase com nota de corte 7.0 + notifica candidato quando houver mudança
  try {
    const year = workflowService.getEditalYearForSubmission(protocol);

    const maybeNotify = async (phaseKey, score) => {
      const before = phaseStatusRepo && typeof phaseStatusRepo.find === 'function'
        ? await Promise.resolve(phaseStatusRepo.find(year, protocol, phaseKey))
        : null;
      const applied = await workflowService.applyCutoffAndPersist({ year, submissionProtocol: protocol, phaseKey, score });
      const afterStatus = applied?.status;
      const beforeStatus = before?.status;

      if (afterStatus && (beforeStatus == null || String(beforeStatus) !== String(afterStatus))) {
        await notifyCandidatePhaseResult({ protocol, phaseKey, status: afterStatus, score });
      }
    };

    if (projCount > 0) void maybeNotify(PHASE.PROJETO, projTotal);
    if (intCount > 0) void maybeNotify(PHASE.ENTREVISTA, intTotal);
    if (langCount > 0) void maybeNotify(PHASE.LINGUA, lang_total);
  } catch (err) {
    // não bloqueia o salvamento; apenas loga
    console.error('Falha ao atualizar status do workflow', err);
  }

  return res.redirect(`/secret/${ADMIN_SECRET}/committee/evaluate/${encodeURIComponent(protocol)}`);
});

app.post(`/secret/${ADMIN_SECRET}/admin/submission/:protocol`, checkAdminIP, adminAuth, async (req, res) => {
  const protocol = req.params.protocol;
  const record = await Promise.resolve(submissionRepo.findByProtocol(protocol));
  if (!record) return res.status(404).send('Não encontrado');

  const status = normalizeStatus(req.body?.status);
  const notesRaw = String(req.body?.observacoes_internas ?? '');
  const notes = notesRaw.length > 5000 ? notesRaw.slice(0, 5000) : notesRaw;

  record.status = status;
  record.adminNotes = notes;
  record.adminUpdatedAt = new Date().toISOString();
  await Promise.resolve(submissionRepo.save(record));

  return res.redirect(`/secret/${ADMIN_SECRET}/admin/submission/${encodeURIComponent(protocol)}`);
});

// POC: Teste de Certificado
app.get(`/secret/${ADMIN_SECRET}/admin/certificados/teste`, checkAdminIP, adminAuth, (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Teste de Certificado</title>
      <link rel="stylesheet" href="/theme.css" />
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            <h1>Gerador de Certificado (Teste)</h1>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'events' })}
        <form method="POST" action="/secret/${ADMIN_SECRET}/admin/certificados/teste" target="_blank">
          <section class="panel">
            <div class="panel-header"><h2>Dados do Certificado</h2></div>
            <div class="panel-body">
              <div class="form-group">
                <label>Nome do Participante</label>
                <input type="text" name="nome" value="LUIZ DIEGO VIDAL SANTOS" required />
              </div>
              <div class="form-group">
                <label>CPF</label>
                <input type="text" name="cpf" value="033.281.915-93" required />
              </div>
              <div class="form-group">
                <label>Nome do Evento/Atividade de Extensão</label>
                <input type="text" name="curso" value="PLANEJAMENTO DO ESPAÇO URBANO" required />
              </div>
              <div class="form-group">
                <label>Coordenador(a)</label>
                <input type="text" name="coordinator" value="Professor(a) Wodis Kleber Oliveira Araujo" />
              </div>
              <div class="form-group">
                <label>Departamento/Órgão Promotor</label>
                <input type="text" name="department" value="DEPARTAMENTO DE CIÊNCIAS HUMANDAS E FILOSOFIA" />
              </div>
              <div class="form-group">
                <label>Palestrante(s)/Ministrante(s) (Opcional)</label>
                <input type="text" name="speakers" value="" />
              </div>
              <div class="form-group">
                <label>Função do Participante</label>
                <input type="text" name="role" value="COLABORADOR (A)" />
              </div>
              <div class="form-group">
                <label>Data de Realização</label>
                <input type="text" name="data" value="19 de Agosto de 2025" />
              </div>
              <div class="form-group">
                <label>Carga Horária</label>
                <input type="text" name="cargaHoraria" value="1 hora(s)" />
              </div>
              <div class="form-group">
                <label>Texto Livre (Opcional)</label>
                <textarea name="textoLivre" rows="3"></textarea>
              </div>
              <button type="submit" class="btn-primary">Gerar PDF</button>
            </div>
          </section>
        </form>
      </div>
    </body>
    </html>
  `);
});

app.post(`/secret/${ADMIN_SECRET}/admin/certificados/teste`, checkAdminIP, adminAuth, async (req, res) => {
  try {
    const { nome, cpf, curso, data, cargaHoraria, textoLivre, coordinator, department, speakers, role } = req.body;
    
    const auditInfo = {
      ip: getClientIP(req),
      user: { username: req.session.user || 'admin' },
      createdAt: new Date()
    };

    // Exemplo de atividades para teste
    const exampleActivities = [
      { name: 'Workshop Redação de Patentes, Além dos Guias + Oficinas Práticas', role: 'PARTICIPANTE', workload: 12 }
    ];

    const pdfBuffer = await pdfService.generateCertificatePdf({
      nome, 
      cpf, 
      curso, 
      data, 
      cargaHoraria, 
      textoLivre,
      coordinator,
      department,
      speakers,
      role,
      syllabus: 'Curso de extensão focado em propriedade intelectual e redação de patentes.',
      activities: exampleActivities
    }, auditInfo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="certificado-teste.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erro ao gerar certificado:', err);
    res.status(500).send('Erro ao gerar certificado: ' + err.message);
  }
});

app.get(`/secret/${ADMIN_SECRET}/admin/submission/:protocol`, checkAdminIP, adminAuth, async (req, res) => {
  const protocol = req.params.protocol;
  const record = await Promise.resolve(submissionRepo.findByProtocol(protocol));
  if (!record) return res.status(404).send('Não encontrado');

  const verifyUrl = `/api/verify/${encodeURIComponent(protocol)}`;

  const formVersion = record.formVersion || record.form_version || '';
  const project = record.project || record.blind || {};

  const payloadForHash = {
    protocol: record.protocol,
    createdAt: record.createdAt,
    form_version: formVersion,
    identified: record.identified,
    project,
  };
  const computedHash = sha256Hex(stableStringify(payloadForHash));
  const hashValid = computedHash === record.hash;
  const recordStatus = normalizeStatus(record.status);
  const adminNotes = String(record.adminNotes ?? '');

  const appealsForSubmission = typeof appealRepo.findBySubmissionProtocol === 'function'
    ? await Promise.resolve(appealRepo.findBySubmissionProtocol(protocol))
    : [];
  const ETAPAS = ['Inscrição', 'Avaliação do Projeto', 'Entrevista', 'Prova de Língua Estrangeira'];

  const renderAppealsTableRows = () => {
    const byEtapa = new Map(ETAPAS.map((e) => [e, []]));
    (appealsForSubmission || []).forEach((a) => {
      const etapa = String(a?.etapa || '').trim();
      if (!byEtapa.has(etapa)) byEtapa.set(etapa, []);
      byEtapa.get(etapa).push(a);
    });

    return ETAPAS.map((etapaLabel) => {
      const list = byEtapa.get(etapaLabel) || [];
      if (list.length === 0) {
        return `
          <tr>
            <th>${escapeHtml(etapaLabel)}</th>
            <td><span class="muted">Nenhum recurso registrado</span></td>
            <td style="text-align:center;"><span class="muted">—</span></td>
          </tr>
        `;
      }

      const sorted = [...list].sort((a, b) => String(b?.createdAt || '').localeCompare(String(a?.createdAt || '')));
      const latest = sorted[0];
      const ap = String(latest?.protocol || '').trim();
      const when = latest?.createdAt ? new Date(latest.createdAt).toLocaleString('pt-BR') : '';
      const link = ap ? `/api/appeals/${encodeURIComponent(ap)}/pdf` : '#';

      return `
        <tr>
          <th>${escapeHtml(etapaLabel)}</th>
          <td>
            <div class="mono">${escapeHtml(ap || '-') }</div>
            <div class="muted" style="font-size: 11px; margin-top: 4px;">${escapeHtml(when)}</div>
          </td>
          <td style="text-align:center;">${ap ? `<a class="btn-secondary" href="${link}" target="_blank" rel="noopener">Baixar PDF</a>` : '<span class="muted">—</span>'}</td>
        </tr>
      `;
    }).join('');
  };

  // Lógica de Situação / Nota
  const evaluation = await Promise.resolve(evaluationRepo.findByProtocol(protocol));
  let situationDisplay = '<span class="muted">Em análise / Aguardando avaliação</span>';
  
  const st = recordStatus.toLowerCase();

  if (st === 'indeferida' || st === 'indeferido') {
    situationDisplay = '<span style="color:red; font-weight:bold;">INDEFERIDA</span>';
  } else if (st === 'aprovada' || st === 'aprovado') {
    situationDisplay = '<span style="color:green; font-weight:bold;">APROVADA</span>';
  } else if (st === 'em recurso') {
    situationDisplay = '<span style="color:orange; font-weight:bold;">EM RECURSO</span>';
  } else if (evaluation) {
    const proj = Number(evaluation.proj_total || 0);
    const intr = Number(evaluation.int_total || 0);
    const lang = Number(evaluation.lang_total || 0);
    
    if (proj < 7 || intr < 7 || lang < 7) {
        situationDisplay = '<span style="color:red; font-weight:bold;">REPROVADO (Nota < 7 em alguma etapa)</span>';
    } else {
        const WEIGHTS = { project: 4, interview: 5, language: 1 };
        const MAX = { project: 10, interview: 10, language: 10 };
        const projNorm = Math.max(0, Math.min(1, proj / MAX.project));
        const intrNorm = Math.max(0, Math.min(1, intr / MAX.interview));
        const langNorm = Math.max(0, Math.min(1, lang / MAX.language));
        const weighted = (projNorm * WEIGHTS.project) + (intrNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
        situationDisplay = `<span style="color:green; font-weight:bold;">DEFERIDA (Nota: ${weighted.toFixed(2)})</span>`;
    }
  } else if (st === 'em análise' || st === 'em analise') {
    situationDisplay = '<span style="color:blue; font-weight:bold;">EM ANÁLISE</span>';
  } else if (st === 'recebida' || st === 'recebido') {
    situationDisplay = '<span style="font-weight:bold;">RECEBIDA</span>';
  }

  function safeValue(value) {
    const text = String(value ?? '').trim();
    return text ? escapeHtml(text) : '<span class="muted">—</span>';
  }

  function safeMultiline(value) {
    const text = String(value ?? '').trim();
    if (!text) return '<span class="muted">—</span>';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function coalesceProjectField(...values) {
    for (const v of values) {
      const text = String(v ?? '').trim();
      if (text) return text;
    }
    return '';
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Admin - ${escapeHtml(protocol)}</title>
      <link rel="stylesheet" href="/theme.css" />
      <style>
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .muted { color: #003366; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; }
        .sectionTitle { margin: 10px 0 6px; }
        .box { border: 1px solid #86A3C2; background-color: #fff; padding: 8px; }
        .kv { width: 100%; border-collapse: collapse; background-color: #fff; }
        .kv th, .kv td { border: 1px solid #86A3C2; padding: 6px; vertical-align: top; }
        .kv th { background-color: #D0E5F5; color: #003366; text-align: left; width: 34%; }
        .badge { display: inline-block; padding: 2px 8px; border: 1px solid #86A3C2; background-color: #F4F9FD; color: #003366; font-weight: bold; }
        @media (max-width: 900px) { .grid, .summary { grid-template-columns: 1fr; } }

        @media print {
          body { background: #fff; padding: 0; }
          .container { border: none; max-width: none; margin: 0; }
          .main-header { border-bottom: 2px solid #003366; }
          a, button { display: none !important; }
          .admin-actions { display: none !important; }
          .panel { break-inside: avoid; page-break-inside: avoid; }
        }

        @page { margin: 12mm; }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            <h1>Administração de Inscrições - AVALIA+</h1>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'selection' })}

        <div class="admin-actions" style="justify-content: center; margin-bottom: 10px;">
          <button class="btn-secondary" type="button" id="print-btn">Imprimir / Salvar em PDF</button>
          <span class="admin-badge">Protocolo: <span class="mono" id="protocol">${escapeHtml(protocol)}</span></span>
          <span class="admin-badge">Status integridade: ${hashValid ? 'Íntegra (hash confere)' : 'Atenção: hash não confere'}</span>
        </div>

        <section class="panel">
          <div class="panel-header"><h2>Resumo</h2></div>
          <div class="panel-body">
            <div class="summary">
              <div><strong>Data/Hora:</strong> ${escapeHtml(new Date(record.createdAt).toLocaleString('pt-BR'))}</div>
              <div><strong>CPF:</strong> ${safeValue(record.identified?.cpf || record.cpfLast4)}</div>
              <div><strong>Nome:</strong> ${safeValue(record.identified?.nome)}</div>
              <div><strong>Email:</strong> ${safeValue(record.identified?.email)}</div>
              <div><strong>Versão do formulário:</strong> ${safeValue(record.formVersion)}</div>
              <div><strong>Verificação (JSON):</strong> <a href="${verifyUrl}">${verifyUrl}</a></div>
              <div style="grid-column: 1 / -1; margin-top: 8px; padding: 8px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px;">
                <strong>Situação Atual:</strong> ${situationDisplay}
              </div>
            </div>

            <div class="sectionTitle"><strong>Status e observações internas</strong></div>
            <form method="POST" action="/secret/${ADMIN_SECRET}/admin/submission/${encodeURIComponent(protocol)}">
              <div class="grid" style="grid-template-columns: 1fr; gap: 8px;">
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="status">Status</label>
                  <select id="status" name="status">
                    ${ADMIN_STATUS_OPTIONS.map(opt => {
                      const sel = recordStatus === opt ? 'selected' : '';
                      return `<option value="${escapeHtml(opt)}" ${sel}>${escapeHtml(opt)}</option>`;
                    }).join('')}
                  </select>
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                  <label for="observacoes_internas">Observações internas (não vai para o PDF)</label>
                  <textarea id="observacoes_internas" name="observacoes_internas" rows="5">${escapeHtml(adminNotes)}</textarea>
                </div>
                <div class="admin-actions" style="justify-content:center;">
                  <button class="btn-primary" type="submit">Salvar</button>
                </div>
              </div>
            </form>

            <div class="sectionTitle"><strong>Código de verificação (hash)</strong></div>
            <div class="admin-box">
              <div class="mono" style="word-break: break-word;" id="hash">${escapeHtml(record.hash)}</div>
              <div class="muted" style="margin-top: 6px;">Use este código para conferir se o registro/PDF não foi alterado.</div>
              <div class="admin-actions" style="justify-content:center; margin-top: 8px;">
                <button class="btn-secondary" type="button" data-copy="#protocol">Copiar protocolo</button>
                <button class="btn-secondary" type="button" data-copy="#hash">Copiar hash</button>
              </div>
            </div>
          </div>
        </section>

        <section class="panel" style="margin-top: 10px;">
          <div class="panel-header"><h2>Recursos do candidato (por etapa)</h2></div>
          <div class="panel-body" style="background-color:#fff; overflow-x:auto;">
            <table class="kv" role="table">
              <tbody>
                ${renderAppealsTableRows()}
              </tbody>
            </table>
            ${(appealsForSubmission || []).length === 0 ? '<div class="muted" style="margin-top: 10px; text-align:center;">Nenhum recurso cadastrado para esta inscrição.</div>' : ''}
          </div>
        </section>

        <div class="grid" style="margin-top: 10px;">
          <section class="panel" style="margin-bottom: 0;">
            <div class="panel-header"><h2>Identificação (ficha)</h2></div>
            <div class="panel-body" style="background-color:#fff;">
              <table class="kv" role="table">
            <tbody>
              <tr><th>Nome</th><td>${safeValue(record.identified?.nome)}</td></tr>
              <tr><th>Nome social</th><td>${safeValue(record.identified?.nome_social)}</td></tr>
              <tr><th>Data de nascimento</th><td>${safeValue(record.identified?.data_nascimento)}</td></tr>
              <tr><th>RG</th><td>${safeValue(record.identified?.rg)}</td></tr>
              <tr><th>Órgão expedidor</th><td>${safeValue(record.identified?.orgao_expedidor)}</td></tr>
              <tr><th>Data de expedição</th><td>${safeValue(record.identified?.data_expedicao)}</td></tr>
              <tr><th>Endereço</th><td>${safeValue(record.identified?.endereco)}</td></tr>
              <tr><th>Cidade/Estado</th><td>${safeValue(record.identified?.cidade_estado)}</td></tr>
              <tr><th>CEP</th><td>${safeValue(record.identified?.cep)}</td></tr>
              <tr><th>Celular</th><td>${safeValue(record.identified?.celular)}</td></tr>
              <tr><th>Telefone residencial</th><td>${safeValue(record.identified?.telefone_residencial)}</td></tr>
              <tr><th>Email</th><td>${safeValue(record.identified?.email)}</td></tr>
              <tr><th>Curso de graduação</th><td>${safeValue(record.identified?.curso_graduacao)}</td></tr>
              <tr><th>Instituição</th><td>${safeValue(record.identified?.instituicao)}</td></tr>
              <tr><th>Ano de conclusão</th><td>${safeValue(record.identified?.ano_conclusao)}</td></tr>
              <tr><th>Vagas / cotas</th><td>${safeValue(record.identified?.vaga_institucional || record.identified?.vaga_cooperacao || record.identified?.vaga_reservada || record.identified?.cotas)}</td></tr>
              <tr><th>Raça/Cor</th><td>${safeValue(record.identified?.raca_cor)}</td></tr>
              <tr><th>Língua estrangeira</th><td>${safeValue(record.identified?.lingua_estrangeira)}</td></tr>
              <tr><th>Vínculo empregatício</th><td>${safeValue(record.identified?.vinculo_empregaticio)}</td></tr>
              <tr><th>Carga horária</th><td>${safeValue(record.identified?.carga_horaria)}</td></tr>
              <tr><th>Empresa (se houver)</th><td>${safeValue(record.identified?.empresa_vinculo)}</td></tr>
              <tr><th>Declaração</th><td>${safeValue(record.identified?.termo_compromisso)}</td></tr>
            </tbody>
          </table>
              <div class="muted" style="margin-top: 8px;">Obs.: o CPF completo não é exibido no admin (somente os últimos 4 dígitos).</div>
            </div>
          </section>

          <section class="panel" style="margin-bottom: 0;">
            <div class="panel-header"><h2>Projeto (blind review)</h2></div>
            <div class="panel-body" style="background-color:#fff;">
              <table class="kv" role="table">
            <tbody>
              <tr><th>Título (PT)</th><td>${safeValue(record.project?.titulo_pt)}</td></tr>
              <tr><th>Título (EN)</th><td>${safeValue(record.project?.titulo_en)}</td></tr>
              <tr><th>Área</th><td>${safeValue(record.project?.area)}</td></tr>
              <tr><th>Palavras-chave (PT)</th><td>${safeValue(record.project?.palavras_pt)}</td></tr>
              <tr><th>Keywords (EN)</th><td>${safeValue(record.project?.palavras_en)}</td></tr>
            </tbody>
          </table>

          <div class="sectionTitle"><strong>Justificativa para enquadramento na linha de pesquisa</strong></div>
          <div class="box">${safeMultiline(record.project?.justificativa_enquadramento)}</div>

          <div class="sectionTitle"><strong>Resumo</strong></div>
          <div class="box">${safeMultiline(record.project?.resumo)}</div>

          <div class="sectionTitle"><strong>1 – Introdução / Contextualização</strong></div>
          <div class="box">${safeMultiline(record.project?.introducao)}</div>

          <div class="sectionTitle"><strong>2 – Problema ou questão de pesquisa</strong></div>
          <div class="box">${safeMultiline(record.project?.problema_pesquisa)}</div>

          <div class="sectionTitle"><strong>3 – Justificativa (relevância do tema)</strong></div>
          <div class="box">${safeMultiline(record.project?.justificativa_relevancia)}</div>

          <div class="sectionTitle"><strong>4 – Objetivos</strong></div>
          <div class="sectionTitle"><strong>Objetivo geral</strong></div>
          <div class="box">${safeMultiline(coalesceProjectField(record.project?.objetivo_geral, record.project?.objetivos_geral_especificos, record.project?.objetivos))}</div>

          <div class="sectionTitle"><strong>Objetivos específicos</strong></div>
          <div class="box">${safeMultiline(coalesceProjectField(record.project?.objetivos_especificos))}</div>
            </div>
          </section>
        </div>

      </div>

      <script>
        async function copyText(text) {
          try {
            if (navigator.clipboard && window.isSecureContext) {
              await navigator.clipboard.writeText(text);
              return true;
            }
          } catch (e) {}

          try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
          } catch (e) {
            return false;
          }
        }

        document.addEventListener('click', async (ev) => {
          const btn = ev.target.closest('button[data-copy]');
          if (!btn) return;
          const sel = btn.getAttribute('data-copy');
          const el = document.querySelector(sel);
          if (!el) return;

          const text = (el.textContent || '').trim();
          const ok = await copyText(text);
          const old = btn.textContent;
          btn.textContent = ok ? 'Copiado' : 'Falhou';
          setTimeout(() => { btn.textContent = old; }, 900);
        });

        const printBtn = document.getElementById('print-btn');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            window.print();
          });
        }
      </script>
    </body>
    </html>
  `);
});

// --- ROTAS PARA AVALIADORES INDIVIDUAIS ---

// 1. Página de Credenciais para o Presidente copiar
app.get(`/secret/${ADMIN_SECRET}/evaluator-links`, checkAdminIP, adminAuth, (req, res) => {
  const loginUrl = `${req.protocol}://${req.get('host')}/secret/${ADMIN_SECRET}/`;
  
  const EVALUATORS = storage.getEvaluators();
  const users = Object.entries(EVALUATORS).map(([user, data]) => ({
    user,
    pass: data.pass,
    label: `Avaliador ${data.num} - Linha ${data.line}`
  }));

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Credenciais dos Avaliadores</title>
      <link rel="stylesheet" href="/theme.css" />
      <style>
        .link-box { background: white; padding: 15px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; }
        .link-url { font-family: monospace; background: #f5f5f5; padding: 8px; border: 1px solid #ccc; display: block; margin-top: 5px; word-break: break-all; width: 100%; box-sizing: border-box; }
        .cred-row { display: flex; gap: 10px; margin-top: 5px; align-items: flex-end; }
        .cred-item { flex: 1; }
        .cred-label { font-size: 0.8rem; color: #666; margin-bottom: 4px; display: block; }
        .cred-input { font-family: monospace; font-weight: bold; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; width: 100%; box-sizing: border-box; }
        .btn-update { background-color: #003366; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.9rem; }
        .btn-update:hover { background-color: #002244; }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            <h1>Credenciais de Acesso - Avaliadores</h1>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        ${renderAdminNav({ adminSecret: ADMIN_SECRET, active: 'evaluator-links' })}
        
        <div class="panel">
          <div class="panel-body">
            <p>Envie o link de login e as credenciais abaixo para cada avaliador. Você pode alterar o usuário e senha conforme necessário.</p>
            
            <div class="link-box" style="background: #eef; border-color: #ccf;">
              <strong>Link de Login (Comum a todos):</strong>
              <input type="text" class="link-url" value="${loginUrl}" readonly onclick="this.select();">
            </div>

            ${users.map(u => `
              <div class="link-box">
                <strong>${escapeHtml(u.label)}</strong>
                <form action="/secret/${ADMIN_SECRET}/update-evaluator" method="POST" style="margin-top: 10px;">
                  <input type="hidden" name="originalUser" value="${u.user}">
                  <div class="cred-row">
                    <div class="cred-item">
                      <label class="cred-label">Usuário (Login)</label>
                      <input type="text" name="newUser" class="cred-input" value="${u.user}" required>
                    </div>
                    <div class="cred-item">
                      <label class="cred-label">Senha</label>
                      <input type="text" name="newPass" class="cred-input" value="${u.pass}" required>
                    </div>
                    <div class="cred-item" style="flex: 0 0 auto;">
                      <button type="submit" class="btn-update">Salvar</button>
                    </div>
                  </div>
                </form>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Rota para atualizar credenciais
app.post(`/secret/${ADMIN_SECRET}/update-evaluator`, checkAdminIP, adminAuth, (req, res) => {
  const { originalUser, newUser, newPass } = req.body;
  const evaluators = storage.getEvaluators();

  if (!evaluators[originalUser]) {
    return res.status(404).send('Avaliador original não encontrado.');
  }

  // Se o usuário mudou, precisamos criar uma nova entrada e remover a antiga
  if (originalUser !== newUser) {
    if (evaluators[newUser]) {
      return res.status(400).send('Este nome de usuário já está em uso.');
    }
    evaluators[newUser] = { ...evaluators[originalUser], pass: newPass };
    delete evaluators[originalUser];
  } else {
    // Apenas atualiza a senha
    evaluators[originalUser].pass = newPass;
  }

  storage.saveEvaluators(evaluators);
  res.redirect(`/secret/${ADMIN_SECRET}/evaluator-links`);
});

// Middleware para verificar autenticação de avaliador
function evaluatorAuth(req, res, next) {
  const token = req.session.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) return res.redirect(`/secret/${ADMIN_SECRET}/`);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    // Atualiza o contexto (ator) após autenticação
    refreshActorFromReq(req);
    // Se for admin, deixa passar (tem acesso a tudo)
    if (decoded.role === 'admin') return next();
    
    // Se for avaliador, verifica se está acessando a rota correta
    if (decoded.role === 'evaluator') {
      const { line, num } = req.params;
      // Se a rota tem parametros line/num, verifica se batem
      if (line && num) {
        if (String(decoded.line) !== String(line) || String(decoded.num) !== String(num)) {
          return res.status(403).send('Acesso negado: Você não tem permissão para acessar a área de outro avaliador.');
        }
      }
      return next();
    }
    
    res.status(403).send('Acesso não autorizado');
  } catch (e) {
    res.redirect(`/secret/${ADMIN_SECRET}/`);
  }
}

function assertSubmissionBelongsToLine(submission, line) {
  const lineStr = line === '1' ? 'Linha de Pesquisa 1' : 'Linha de Pesquisa 2';
  return String(submission?.project?.area || '').includes(lineStr);
}

function normalizeEvaluationRecord(raw) {
  // Compat: algumas rotas gravam { projectScores, interviewScores, languageScores }
  // enquanto as telas do painel usam chaves planas (proj_avaliadorX_..., etc.).
  const e = raw && typeof raw === 'object' ? raw : {};
  const flat = { ...e };

  if (e.projectScores && typeof e.projectScores === 'object') {
    for (const [k, v] of Object.entries(e.projectScores)) {
      if (flat[k] === undefined) flat[k] = v;
    }
  }
  if (e.interviewScores && typeof e.interviewScores === 'object') {
    for (const [k, v] of Object.entries(e.interviewScores)) {
      if (flat[k] === undefined) flat[k] = v;
    }
  }
  if (e.languageScores && typeof e.languageScores === 'object') {
    for (const [k, v] of Object.entries(e.languageScores)) {
      if (flat[k] === undefined) flat[k] = v;
    }
  }

  return flat;
}

function computeTotalsFromFlatEvaluation(e) {
  const evaluators = ['avaliador1', 'avaliador2', 'avaliador3'];
  const projectKeys = ['proj_intro', 'proj_problem', 'proj_just', 'proj_objectives', 'proj_review', 'proj_methods', 'proj_schedule', 'proj_refs'];

  const projEvaluatorSums = evaluators.map(who => {
    return projectKeys.reduce((sum, k) => {
      const key = `proj_${who}_${k}`;
      return sum + (Number(e[key]) || 0);
    }, 0);
  });
  const proj_total = projEvaluatorSums.reduce((a, b) => a + b, 0) / 3;

  const intEvaluatorSums = evaluators.map(who => {
    const prefix = `int_${who}`;
    const ap = Number(e[`${prefix}_apresentacao`]) || 0;
    const hp = Number(e[`${prefix}_historico`]) || 0;
    const df = Number(e[`${prefix}_defesa`]) || 0;
    const ji = Number(e[`${prefix}_justificativa`]) || 0;
    return ap + hp + df + ji;
  });
  const int_total = intEvaluatorSums.reduce((a, b) => a + b, 0) / 3;

  const langEvaluatorSums = evaluators.map(who => {
    const prefix = `lang_${who}`;
    const c = Number(e[`${prefix}_clareza`]) || 0;
    const d = Number(e[`${prefix}_domino`]) || 0;
    const a = Number(e[`${prefix}_analise`]) || 0;
    return (c * 0.3) + (d * 0.4) + (a * 0.3);
  });
  const lang_total = langEvaluatorSums.reduce((a, b) => a + b, 0) / 3;

  return { proj_total, int_total, lang_total };
}

// 2. Dashboard do Avaliador
app.get(`/secret/${ADMIN_SECRET}/evaluator/:line/:num`, evaluatorAuth, async (req, res) => {
  const line = req.params.line; // '1' or '2'
  const num = req.params.num;   // '1', '2', or '3'
  
  if (!['1', '2'].includes(line) || !['1', '2', '3'].includes(num)) {
    return res.status(404).send('Link inválido');
  }

  const subs = await Promise.resolve(submissionRepo.findAll());
  const evals = await Promise.resolve(evaluationRepo.getAll());
  const evalMap = new Map(evals.map(e => [e.protocol, e]));

  // Filter by Line
  const lineStr = line === '1' ? 'Linha de Pesquisa 1' : 'Linha de Pesquisa 2';
  const mySubs = subs.filter(s => (s.project?.area || '').includes(lineStr));

  // Helper to check if this evaluator has evaluated
  function getStatus(protocol) {
    const e = normalizeEvaluationRecord(evalMap.get(protocol) || null);
    if (!e) return 'Pendente';
    
    // Check if any field for this evaluator is filled
    // e.g. proj_avaliador1_intro
    const prefix = `proj_avaliador${num}_`;
    const hasScore = Object.keys(e).some(k => k.startsWith(prefix) && e[k] !== '');
    return hasScore ? 'Avaliado (Parcial ou Completo)' : 'Pendente';
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Avaliador ${num} - Linha ${line}</title>
      <link rel="stylesheet" href="/theme.css" />
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            <div style="text-align:center;">
              <h1 style="margin:0;">Painel do Avaliador ${num}</h1>
              <div style="font-size: 1rem; font-weight: normal; color:#003366; margin-top:2px;">Linha ${line}</div>
            </div>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>
        <div class="admin-actions" style="justify-content:center; margin-bottom:10px;">
          <form action="/secret/${ADMIN_SECRET}/logout" method="POST" style="display:inline; margin:0;">
            <button type="submit" class="btn-secondary" style="font-size:0.8rem;">Sair</button>
          </form>
        </div>
        
        <section class="panel">
          <div class="panel-body" style="background-color:#fff;">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Título</th>
                  <th>Status da Avaliação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                ${mySubs.length ? mySubs.map(s => `
                  <tr>
                    <td>${escapeHtml(s.protocol)}</td>
                    <td>${escapeHtml((s.project?.titulo_pt || '').slice(0, 80))}</td>
                    <td>${getStatus(s.protocol)}</td>
                    <td>
                      <a class="btn-primary" href="/secret/${ADMIN_SECRET}/evaluator/${line}/${num}/project/${encodeURIComponent(s.protocol)}">Avaliar</a>
                    </td>
                  </tr>
                `).join('') : '<tr><td colspan="4">Nenhum candidato nesta linha.</td></tr>'}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </body>
    </html>
  `);
});

// 3. Formulário de Avaliação Individual
app.get(`/secret/${ADMIN_SECRET}/evaluator/:line/:num/evaluate/:protocol`, evaluatorAuth, async (req, res) => {
  const { line, num, protocol } = req.params;
  const s = await Promise.resolve(submissionRepo.findByProtocol(protocol));
  if (!s) return res.status(404).send('Não encontrado');

  if (req.user?.role !== 'admin' && !assertSubmissionBelongsToLine(s, line)) {
    return res.status(403).send('Acesso negado: candidato não pertence à sua linha.');
  }

  // Tela /evaluate ficou redundante: agora o avaliador avalia diretamente na página do projeto.
  return res.redirect(`/secret/${ADMIN_SECRET}/evaluator/${line}/${num}/project/${encodeURIComponent(protocol)}`);
});

// 3.1 Visualizar/Imprimir Projeto (sem ficha) — Avaliador
app.get(`/secret/${ADMIN_SECRET}/evaluator/:line/:num/project/:protocol`, evaluatorAuth, async (req, res) => {
  const { line, num, protocol } = req.params;
  const s = await Promise.resolve(submissionRepo.findByProtocol(protocol));
  if (!s) return res.status(404).send('Não encontrado');

  if (req.user?.role !== 'admin' && !assertSubmissionBelongsToLine(s, line)) {
    return res.status(403).send('Acesso negado: candidato não pertence à sua linha.');
  }

  const eRaw = await Promise.resolve(evaluationRepo.findByProtocol(protocol));
  const e = normalizeEvaluationRecord(eRaw || {});
  const who = `avaliador${num}`; // avaliador1, avaliador2, avaliador3
  const project = s.project || {};

  const projectRubric = [
    { key: 'proj_intro', label: '1 – Introdução / Contextualização', max: 1 },
    { key: 'proj_problem', label: '2 – Problema ou questão de pesquisa', max: 1.5 },
    { key: 'proj_just', label: '3 – Justificativa (relevância e viabilidade)', max: 1 },
    { key: 'proj_objectives', label: '4 – Objetivos (geral e específicos)', max: 2 },
    { key: 'proj_review', label: '5 – Revisão da literatura', max: 1 },
    { key: 'proj_methods', label: '6 – Procedimentos metodológicos', max: 2.5 },
    { key: 'proj_schedule', label: '7 – Cronograma (2 anos)', max: 0.5 },
    { key: 'proj_refs', label: '8 – Referências (ABNT)', max: 0.5 },
  ];

  const savedProjTotal = e.proj_total != null ? Number(e.proj_total) : null;
  const savedIntTotal = e.int_total != null ? Number(e.int_total) : null;
  const savedLangTotal = e.lang_total != null ? Number(e.lang_total) : null;
  const savedUpdatedAt = e.updatedAt ? String(e.updatedAt) : '';

  function safeValue(value) {
    const text = String(value ?? '').trim();
    return text ? escapeHtml(text) : '<span class="muted">—</span>';
  }

  function safeMultiline(value) {
    const text = String(value ?? '').trim();
    if (!text) return '<span class="muted">—</span>';
    return escapeHtml(text).replace(/\n/g, '<br>');
  }

  function coalesceProjectField(...values) {
    for (const v of values) {
      const text = String(v ?? '').trim();
      if (text) return text;
    }
    return '';
  }

  res.type('html').send(`
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Projeto e Avaliação - ${escapeHtml(protocol)}</title>
      <link rel="stylesheet" href="/theme.css" />
      <style>
        .muted { color: #003366; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .sectionTitle { margin: 10px 0 6px; }
        .box { border: 1px solid #86A3C2; background-color: #fff; padding: 8px; }
        .kv { width: 100%; border-collapse: collapse; background-color: #fff; }
        .kv th, .kv td { border: 1px solid #86A3C2; padding: 6px; vertical-align: top; }
        .kv th { background-color: #D0E5F5; color: #003366; text-align: left; width: 34%; }
        .eval-input {
          width: 100%;
          padding: 6px;
          border: 1px solid #86A3C2;
          border-radius: 4px;
          box-sizing: border-box;
          font-size: 12px;
          background: #fff;
        }

        .panel-body input[type="number"],
        .panel-body input[type="text"],
        .panel-body textarea {
          border-radius: 4px;
        }

        @media print {
          body { background: #fff; padding: 0; }
          .container { border: none; max-width: none; margin: 0; }
          a, button { display: none !important; }
          .admin-actions { display: none !important; }
          /* Evita página em branco quando um painel é maior que uma folha */
          .panel { break-inside: auto; page-break-inside: auto; }
          .panel-header { break-after: avoid; page-break-after: avoid; }
        }

        @page { margin: 12mm; }
      </style>
    </head>
    <body>
      <div class="container">
        <header class="main-header">
          <div style="display:flex; align-items:center; justify-content:center; gap:15px;">
            <img src="/img/logo_planter.png" alt="Logo PLANTERR" style="max-height:80px; width:auto;">
            <div style="text-align:center;">
              <h1 style="margin:0;">Projeto e Avaliação</h1>
              <div style="font-size: 0.95rem; font-weight: normal; color:#003366; margin-top:2px;">(visualização e preenchimento)</div>
            </div>
            <img src="/img/logo_avalia_horizontal.png" alt="Logo AVALIA+" style="max-height:80px; width:auto;">
          </div>
        </header>

        <div class="admin-actions" style="justify-content:center; gap:8px; margin-bottom:10px;">
          <a class="btn-secondary" href="/secret/${ADMIN_SECRET}/evaluator/${line}/${num}">← Voltar para Lista</a>
          <button class="btn-secondary" type="button" id="print-btn">Imprimir / Salvar em PDF</button>
          <span class="admin-badge">Protocolo: <span class="mono" id="protocol">${escapeHtml(protocol)}</span></span>
          <span class="admin-badge">Avaliador ${escapeHtml(String(num))} | Linha ${escapeHtml(String(line))}</span>
        </div>

        <section class="panel">
          <div class="panel-header"><h2>Projeto (blind review)</h2></div>
          <div class="panel-body" style="background-color:#fff;">
            <table class="kv" role="table">
              <tbody>
                <tr><th>Protocolo</th><td>${escapeHtml(protocol)}</td></tr>
                <tr><th>Título (PT)</th><td>${safeValue(project?.titulo_pt)}</td></tr>
                <tr><th>Título (EN)</th><td>${safeValue(project?.titulo_en)}</td></tr>
                <tr><th>Área</th><td>${safeValue(project?.area)}</td></tr>
                <tr><th>Palavras-chave (PT)</th><td>${safeValue(project?.palavras_pt)}</td></tr>
                <tr><th>Keywords (EN)</th><td>${safeValue(project?.palavras_en)}</td></tr>
              </tbody>
            </table>

            <div class="sectionTitle"><strong>Justificativa para enquadramento na linha de pesquisa</strong></div>
            <div class="box">${safeMultiline(project?.justificativa_enquadramento)}</div>

            <div class="sectionTitle"><strong>Resumo</strong></div>
            <div class="box">${safeMultiline(project?.resumo)}</div>

            <div class="sectionTitle"><strong>1 – Introdução / Contextualização</strong></div>
            <div class="box">${safeMultiline(project?.introducao)}</div>

            <div class="sectionTitle"><strong>2 – Problema ou questão de pesquisa</strong></div>
            <div class="box">${safeMultiline(project?.problema_pesquisa)}</div>

            <div class="sectionTitle"><strong>3 – Justificativa (relevância do tema)</strong></div>
            <div class="box">${safeMultiline(project?.justificativa_relevancia)}</div>

            <div class="sectionTitle"><strong>4 – Objetivos</strong></div>
            <div class="sectionTitle"><strong>Objetivo geral</strong></div>
            <div class="box">${safeMultiline(coalesceProjectField(project?.objetivo_geral, project?.objetivos_geral_especificos, project?.objetivos))}</div>

            <div class="sectionTitle"><strong>Objetivos específicos</strong></div>
            <div class="box">${safeMultiline(coalesceProjectField(project?.objetivos_especificos))}</div>

            <div class="sectionTitle"><strong>5 – Revisão da literatura</strong></div>
            <div class="box">${safeMultiline(project?.revisao_literatura)}</div>

            <div class="sectionTitle"><strong>6 – Procedimentos metodológicos</strong></div>
            <div class="box">${safeMultiline(project?.procedimentos_metodologicos)}</div>

            <div class="sectionTitle"><strong>7 – Cronograma</strong></div>
            <div class="box">${safeMultiline(project?.cronograma)}</div>

            <div class="sectionTitle"><strong>8 – Referências (ABNT)</strong></div>
            <div class="box">${safeMultiline(project?.referencias)}</div>
          </div>
        </section>

        <div style="margin: 40px 0 20px 0; text-align: center; border-top: 2px dashed #86A3C2; position: relative;">
           <span style="background: #f4f7fa; padding: 0 15px; position: relative; top: -12px; font-weight: bold; color: #003366; font-size: 1.1rem;">
             ÁREA DE AVALIAÇÃO (PREENCHIMENTO)
           </span>
           <p style="margin-top: -5px; color: #555; font-size: 0.9rem;">
             Abaixo iniciam-se os campos para atribuição de notas.
           </p>
        </div>

        <form method="POST" action="/secret/${ADMIN_SECRET}/evaluator/${line}/${num}/evaluate/${encodeURIComponent(protocol)}" style="margin-top: 10px;">
          <section class="panel">
            <div class="panel-header"><h2>1. Projeto de Pesquisa</h2></div>
            <div class="panel-body">
              ${projectRubric.map(item => {
                const key = `proj_${who}_${item.key}`;
                const val = e[key] ?? '';
                return `
                  <div class="form-group">
                    <label for="${key}">${escapeHtml(item.label)} (máx. ${item.max})</label>
                    <input type="number" id="${key}" name="${key}" min="0" max="${item.max}" step="0.1" value="${escapeHtml(String(val))}" />
                  </div>
                `;
              }).join('')}
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>2. Entrevista</h2></div>
            <div class="panel-body">
              <div class="form-group">
                <label>Apresentação (máx. 3)</label>
                <input type="number" name="int_${who}_apresentacao" min="0" max="3" step="0.1" value="${escapeHtml(String(e[`int_${who}_apresentacao`] ?? ''))}" />
              </div>
              <div class="form-group">
                <label>Histórico Profissional (máx. 2)</label>
                <input type="number" name="int_${who}_historico" min="0" max="2" step="0.1" value="${escapeHtml(String(e[`int_${who}_historico`] ?? ''))}" />
              </div>
              <div class="form-group">
                <label>Defesa da proposta (máx. 3)</label>
                <input type="number" name="int_${who}_defesa" min="0" max="3" step="0.1" value="${escapeHtml(String(e[`int_${who}_defesa`] ?? ''))}" />
              </div>
              <div class="form-group">
                <label>Justificativa/interesse + disponibilidade (máx. 2)</label>
                <input type="number" name="int_${who}_justificativa" min="0" max="2" step="0.1" value="${escapeHtml(String(e[`int_${who}_justificativa`] ?? ''))}" />
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>3. Prova de Língua</h2></div>
            <div class="panel-body">
              <div class="form-group">
                <label>Clareza e Coesão (0-10)</label>
                <input type="number" name="lang_${who}_clareza" min="0" max="10" step="0.1" value="${escapeHtml(String(e[`lang_${who}_clareza`] ?? ''))}" />
              </div>
              <div class="form-group">
                <label>Domínio do Conteúdo (0-10)</label>
                <input type="number" name="lang_${who}_domino" min="0" max="10" step="0.1" value="${escapeHtml(String(e[`lang_${who}_domino`] ?? ''))}" />
              </div>
              <div class="form-group">
                <label>Análise Crítica (0-10)</label>
                <input type="number" name="lang_${who}_analise" min="0" max="10" step="0.1" value="${escapeHtml(String(e[`lang_${who}_analise`] ?? ''))}" />
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header"><h2>Resumo de Notas (Avaliador)</h2></div>
            <div class="panel-body">
              <div class="hint" style="margin-bottom:8px;">
                As “médias registradas” abaixo são atualizadas quando você clica em “Salvar Minha Avaliação”.
              </div>

              <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label for="my_proj_total">Minha nota do Projeto (0–10)</label>
                  <input type="text" id="my_proj_total" readonly style="background-color:#eee; font-weight:bold;" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label for="my_int_total">Minha nota da Entrevista (0–10)</label>
                  <input type="text" id="my_int_total" readonly style="background-color:#eee; font-weight:bold;" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label for="my_lang_total">Minha nota da Língua (0–10)</label>
                  <input type="text" id="my_lang_total" readonly style="background-color:#eee; font-weight:bold;" />
                </div>
              </div>

              <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top:8px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label for="saved_proj_total">Média registrada (Projeto / 3)</label>
                  <input type="text" id="saved_proj_total" readonly style="background-color:#eee;" value="${savedProjTotal == null ? '' : escapeHtml(savedProjTotal.toFixed(2))}" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label for="saved_int_total">Média registrada (Entrevista / 3)</label>
                  <input type="text" id="saved_int_total" readonly style="background-color:#eee;" value="${savedIntTotal == null ? '' : escapeHtml(savedIntTotal.toFixed(2))}" />
                </div>
                <div class="form-group" style="margin-bottom:0;">
                  <label for="saved_lang_total">Média registrada (Língua / 3)</label>
                  <input type="text" id="saved_lang_total" readonly style="background-color:#eee;" value="${savedLangTotal == null ? '' : escapeHtml(savedLangTotal.toFixed(2))}" />
                </div>
              </div>

              <div class="grid" style="grid-template-columns: 1fr; gap: 8px; margin-top:8px;">
                <div class="form-group" style="margin-bottom:0;">
                  <label for="saved_final_score">Nota final registrada (P=4, E=5, L=1)</label>
                  <input type="text" id="saved_final_score" readonly style="background-color:#eee; font-weight:bold;" />
                </div>
              </div>

              <div class="hint" id="saved_updated_at" style="margin-top:8px;"></div>
            </div>
          </section>

          <div class="admin-actions" style="justify-content:center; margin-top:20px;">
            <button class="btn-primary" type="submit">Salvar Minha Avaliação</button>
          </div>
        </form>
      </div>

      <script>
        const printBtn = document.getElementById('print-btn');
        if (printBtn) {
          printBtn.addEventListener('click', () => {
            window.print();
          });
        }

        (function () {
          const WHO = ${JSON.stringify(who)};

          const savedProj = ${savedProjTotal == null ? 'null' : savedProjTotal.toFixed(10)};
          const savedInt = ${savedIntTotal == null ? 'null' : savedIntTotal.toFixed(10)};
          const savedLang = ${savedLangTotal == null ? 'null' : savedLangTotal.toFixed(10)};
          const savedUpdatedAt = ${JSON.stringify(savedUpdatedAt)};

          const myProjEl = document.getElementById('my_proj_total');
          const myIntEl = document.getElementById('my_int_total');
          const myLangEl = document.getElementById('my_lang_total');
          const savedFinalEl = document.getElementById('saved_final_score');
          const updatedAtEl = document.getElementById('saved_updated_at');

          function num(v) {
            const n = Number(String(v || '').replace(',', '.'));
            return Number.isFinite(n) ? n : 0;
          }

          function calcMine() {
            const projInputs = Array.from(document.querySelectorAll('input[name^="proj_' + WHO + '_"]'));
            const projSum = projInputs.reduce((s, el) => s + num(el.value), 0);

            const intInputs = Array.from(document.querySelectorAll('input[name^="int_' + WHO + '_"]'));
            const intSum = intInputs.reduce((s, el) => s + num(el.value), 0);

            const c = num((document.querySelector('input[name="lang_' + WHO + '_clareza"]') || {}).value);
            const d = num((document.querySelector('input[name="lang_' + WHO + '_domino"]') || {}).value);
            const a = num((document.querySelector('input[name="lang_' + WHO + '_analise"]') || {}).value);
            const langSum = (c * 0.3) + (d * 0.4) + (a * 0.3);

            if (myProjEl) myProjEl.value = projSum.toFixed(2);
            if (myIntEl) myIntEl.value = intSum.toFixed(2);
            if (myLangEl) myLangEl.value = langSum.toFixed(2);
          }

          function calcSavedFinal() {
            if (savedProj == null || savedInt == null || savedLang == null) {
              if (savedFinalEl) savedFinalEl.value = '';
              return;
            }
            const WEIGHTS = { project: 4, interview: 5, language: 1 };
            const MAX = { project: 10, interview: 10, language: 10 };

            const projNorm = Math.max(0, Math.min(1, savedProj / MAX.project));
            const intNorm = Math.max(0, Math.min(1, savedInt / MAX.interview));
            const langNorm = Math.max(0, Math.min(1, savedLang / MAX.language));
            const finalScore = (projNorm * WEIGHTS.project) + (intNorm * WEIGHTS.interview) + (langNorm * WEIGHTS.language);
            if (savedFinalEl) savedFinalEl.value = Number.isFinite(finalScore) ? finalScore.toFixed(2) : '';
          }

          function renderUpdatedAt() {
            if (!updatedAtEl) return;
            if (!savedUpdatedAt) {
              updatedAtEl.textContent = '';
              return;
            }
            try {
              const d = new Date(savedUpdatedAt);
              if (Number.isNaN(d.getTime())) throw new Error('invalid date');
              updatedAtEl.textContent = 'Registrado em: ' + d.toLocaleString('pt-BR');
            } catch {
              updatedAtEl.textContent = 'Registrado em: ' + savedUpdatedAt;
            }
          }

          const inputs = Array.from(document.querySelectorAll('input[name^="proj_' + WHO + '_"], input[name^="int_' + WHO + '_"], input[name^="lang_' + WHO + '_"]'));
          inputs.forEach(el => el.addEventListener('input', calcMine));

          calcMine();
          calcSavedFinal();
          renderUpdatedAt();
        })();
      </script>
    </body>
    </html>
  `);
});

// 4. Processar Avaliação Individual (persistindo no storage para refletir em todas as telas)
app.post(`/secret/${ADMIN_SECRET}/evaluator/:line/:num/evaluate/:protocol`, evaluatorAuth, async (req, res) => {
  const { line, protocol } = req.params;
  const s = await Promise.resolve(submissionRepo.findByProtocol(protocol));
  if (!s) return res.status(404).send('Não encontrado');

  if (req.user?.role !== 'admin' && !assertSubmissionBelongsToLine(s, line)) {
    return res.status(403).send('Acesso negado: candidato não pertence à sua linha.');
  }

  const currentRaw = await Promise.resolve(evaluationRepo.findByProtocol(protocol));
  const current = normalizeEvaluationRecord(currentRaw || {});
  const patch = {};

  for (const [key, value] of Object.entries(req.body || {})) {
    if (key.startsWith('proj_') || key.startsWith('int_') || key.startsWith('lang_')) {
      const raw = String(value ?? '').trim();
      // Importante: se vier vazio, NÃO sobrescreve valor anterior (avaliação por fases)
      if (raw === '') continue;
      const n = Number(raw.replace(',', '.'));
      if (!Number.isFinite(n)) continue;
      patch[key] = n;
    }
    if (key === 'eliminado') patch.eliminado = String(value) === 'Sim';
    if (key === 'observacoes') patch.observacoes = String(value ?? '').slice(0, 2000);
  }

  const next = {
    ...current,
    ...patch,
    protocol,
  };

  const totals = computeTotalsFromFlatEvaluation(next);

  const pickByPrefix = (obj, prefix) => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (k.startsWith(prefix)) out[k] = v;
    }
    return out;
  };

  const projectScores = {
    ...(currentRaw && currentRaw.projectScores ? currentRaw.projectScores : {}),
    ...pickByPrefix(next, 'proj_'),
  };
  const interviewScores = {
    ...(currentRaw && currentRaw.interviewScores ? currentRaw.interviewScores : {}),
    ...pickByPrefix(next, 'int_'),
  };
  const languageScores = {
    ...(currentRaw && currentRaw.languageScores ? currentRaw.languageScores : {}),
    ...pickByPrefix(next, 'lang_'),
  };

  await Promise.resolve(evaluationRepo.save({
    protocol,
    projectScores,
    interviewScores,
    languageScores,
    proj_total: totals.proj_total,
    int_total: totals.int_total,
    lang_total: totals.lang_total,
    eliminado: Boolean(next.eliminado),
    observacoes: String(next.observacoes || ''),
    updatedAt: new Date().toISOString(),
    audit: currentRaw && currentRaw.audit ? currentRaw.audit : null,
  }));

  return res.redirect('back');
});

// Rotas falsas para enganar scanners
app.get(['/admin', '/administrator', '/login', '/wp-admin', '/committee'], (req, res) => {
  logSecurityEvent('HONEYPOT_TRIGGERED', { path: req.path, ip: req.ip });
  // Delay artificial para desperdiçar tempo do atacante
  setTimeout(() => {
    res.status(404).send('Not Found');
  }, 2000);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`🔒 Segurança ativada:`);
    console.log(`   - Admin Secret: /secret/${ADMIN_SECRET}/...`);
    console.log(`   - JWT Auth: Ativo`);
    console.log(`   - Rate Limiting: Ativo`);
    console.log(`   - Logs: server/logs/\n`);
  });
}

module.exports = app;
