/*
Demo seed (local) — cria exemplos de:
- Inscrições (submissions) em server/data/submissions.json
- Recursos (appeals) em server/data/appeals.json
- PDFs de comprovante (inscrição/recurso) e certificado (exemplo)

Uso:
  node server/scripts/demo-seed.js

Saída:
  - prints/demo/*.pdf
  - prints/demo/demo-summary.json

Obs:
- Não envia e-mail.
- Gera CPFs aleatórios apenas para fins de demonstração.
*/

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const RegisterSubmission = require('../src/application/RegisterSubmission');
const RegisterAppeal = require('../src/application/RegisterAppeal');
const JsonSubmissionRepository = require('../src/infrastructure/repositories/JsonSubmissionRepository');
const JsonAppealRepository = require('../src/infrastructure/repositories/JsonAppealRepository');
const PdfService = require('../src/infrastructure/services/PdfService');

const repoRoot = path.resolve(__dirname, '..', '..');
const dataDir = path.join(__dirname, '..', 'data');
const outDir = path.join(repoRoot, 'prints', 'demo');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function createSimplePdfBuffer({ title, subtitle, lines = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(18).text(title || 'Documento', { align: 'center' });
    if (subtitle) {
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(11).fillColor('#333333').text(subtitle, { align: 'center' });
    }
    doc.moveDown(1.5);
    doc.fillColor('#000000');
    doc.font('Helvetica').fontSize(11);

    for (const line of lines) {
      doc.text(String(line || ''), { align: 'left' });
      doc.moveDown(0.4);
    }

    doc.moveDown(1.2);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555555');
    doc.text('Arquivo gerado automaticamente (DEMO).', { align: 'left' });
    doc.end();
  });
}

function randomDigits(n) {
  let s = '';
  for (let i = 0; i < n; i += 1) s += String(Math.floor(Math.random() * 10));
  return s;
}

function generateUniqueCpfDigits(submissionRepo, maxTries = 200) {
  for (let i = 0; i < maxTries; i += 1) {
    const cpf = randomDigits(11);
    // Checagem por hash (mesma regra do RegisterSubmission)
    const crypto = require('crypto');
    const cpfHash = crypto.createHash('sha256').update(cpf).digest('hex');
    const exists = submissionRepo.existsCpfHash(cpfHash);
    if (!exists) return cpf;
  }
  throw new Error('Não foi possível gerar um CPF único para demo (muitas tentativas).');
}

async function main() {
  ensureDir(outDir);

  const submissionRepo = new JsonSubmissionRepository(dataDir);
  const appealRepo = new JsonAppealRepository(dataDir);
  const pdfService = new PdfService();

  const registerSubmission = new RegisterSubmission(
    submissionRepo,
    process.env.HMAC_SECRET || 'demo-hmac-secret',
    null,
    null,
    pdfService,
    ''
  );

  const registerAppeal = new RegisterAppeal(
    appealRepo,
    submissionRepo,
    null,
    null,
    pdfService,
    ''
  );

  const startedAt = new Date().toISOString();

  const cpf1 = generateUniqueCpfDigits(submissionRepo);
  const cpf2 = generateUniqueCpfDigits(submissionRepo);

  const submissionInputs = [
    {
      nome: 'Candidato Demo 1',
      nome_social: 'Candidato Demo 1',
      data_nascimento: '1994-04-12',
      cpf: cpf1,
      rg: '1111111',
      orgao_expedidor: 'SSP-BA',
      data_expedicao: '2012-02-01',
      endereco: 'Rua Exemplo, 100',
      cidade_estado: 'Feira de Santana - BA',
      cep: '44000-000',
      celular: '(75) 90000-0001',
      telefone_residencial: '(75) 3000-0001',
      email: 'demo1@example.com',
      curso_graduacao: 'Geografia',
      instituicao: 'UEFS',
      ano_conclusao: '2018',
      vaga_institucional: 'Sim',
      vaga_cooperacao: 'Não',
      vaga_reservada: 'Não',
      cotas: 'Ampla concorrência',
      raca_cor: 'Parda',
      lingua_estrangeira: 'Inglês',
      vinculo_empregaticio: 'Não',
      carga_horaria: '40h',
      empresa_vinculo: '',
      termo_compromisso: 'Concordo',

      titulo_pt: 'DEMO — Planejamento territorial e dados abertos',
      titulo_en: 'DEMO — Territorial planning and open data',
      area: 'Linha de Pesquisa 2 – Políticas públicas, Planejamento Territorial e Participação Social',
      palavras_pt: 'planejamento; dados abertos; governança',
      palavras_en: 'planning; open data; governance',
      resumo: 'Projeto demo para validar o fluxo de inscrição e geração de comprovante em PDF.',
      justificativa_enquadramento: 'Enquadramento demo na linha escolhida.',
      introducao: 'Introdução demo.',
      problema_pesquisa: 'Como melhorar a transparência com dados abertos?',
      justificativa_relevancia: 'Relevância demo.',
      objetivo_geral: 'Objetivo geral demo.',
      objetivos_especificos: 'Objetivos específicos demo.',
      procedimentos_metodologicos: 'Metodologia demo.',
      cronograma: 'Mês 1: levantamento\nMês 2: protótipo\nMês 3: validação',
      referencias: 'Referências demo.',

      form_version: `demo-seed-${startedAt.slice(0, 10)}`,
    },
    {
      nome: 'Candidata Demo 2',
      nome_social: 'Candidata Demo 2',
      data_nascimento: '1998-09-30',
      cpf: cpf2,
      rg: '2222222',
      orgao_expedidor: 'SSP-BA',
      data_expedicao: '2016-08-10',
      endereco: 'Av. Exemplo, 200',
      cidade_estado: 'Salvador - BA',
      cep: '40000-000',
      celular: '(71) 90000-0002',
      telefone_residencial: '(71) 3000-0002',
      email: 'demo2@example.com',
      curso_graduacao: 'Arquitetura e Urbanismo',
      instituicao: 'UFBA',
      ano_conclusao: '2020',
      vaga_institucional: 'Não',
      vaga_cooperacao: 'Sim',
      vaga_reservada: 'Não',
      cotas: 'Ampla concorrência',
      raca_cor: 'Branca',
      lingua_estrangeira: 'Espanhol',
      vinculo_empregaticio: 'Sim',
      carga_horaria: '30h',
      empresa_vinculo: 'Prefeitura (demo)',
      termo_compromisso: 'Concordo',

      titulo_pt: 'DEMO — Participação social em planos diretores',
      titulo_en: 'DEMO — Social participation in master plans',
      area: 'Linha de Pesquisa 1 – Planejamento e Gestão Urbana e Regional',
      palavras_pt: 'participação; plano diretor; território',
      palavras_en: 'participation; master plan; territory',
      resumo: 'Projeto demo para compor exemplos de dados no sistema.',
      justificativa_enquadramento: 'Enquadramento demo.',
      introducao: 'Introdução demo.',
      problema_pesquisa: 'Como ampliar a participação social?',
      justificativa_relevancia: 'Relevância demo.',
      objetivo_geral: 'Objetivo geral demo.',
      objetivos_especificos: 'Objetivos específicos demo.',
      procedimentos_metodologicos: 'Metodologia demo.',
      cronograma: 'Mês 1: revisão\nMês 2: campo\nMês 3: análise',
      referencias: 'Referências demo.',

      form_version: `demo-seed-${startedAt.slice(0, 10)}`,
    },
  ];

  const createdSubmissions = [];
  for (const input of submissionInputs) {
    const result = await registerSubmission.execute(input, { ip: '127.0.0.1', user: { username: 'demo-seed' }, userAgent: 'demo-seed' });
    const submission = submissionRepo.findByProtocol(result.protocol);
    createdSubmissions.push(submission);

    const pdf = await pdfService.generateSubmissionPdf(submission, {
      ip: '127.0.0.1',
      user: { username: 'demo-seed' },
      userAgent: 'demo-seed',
      createdAt: submission.createdAt,
      hash: submission.hash,
    });

    const pdfPath = path.join(outDir, `inscricao-${submission.protocol}.pdf`);
    fs.writeFileSync(pdfPath, pdf);

    // PDFs que aparecem para o candidato em /candidato/status (Documentos Enviados)
    const projetoPdf = await createSimplePdfBuffer({
      title: 'Projeto de Pesquisa (DEMO)',
      subtitle: `Protocolo: ${submission.protocol}`,
      lines: [
        `Título (PT): ${submission.project?.titulo_pt || '—'}`,
        `Linha/Área: ${submission.project?.area || '—'}`,
        '',
        'Este é um PDF de exemplo para simular o arquivo enviado pelo candidato.',
      ],
    });
    const idiomaPdf = await createSimplePdfBuffer({
      title: 'Certificado de Idioma (DEMO)',
      subtitle: `Protocolo: ${submission.protocol}`,
      lines: [
        `Candidato: ${submission.identified?.nome || '—'}`,
        `Idioma informado: ${submission.identified?.lingua_estrangeira || '—'}`,
        '',
        'Este é um PDF de exemplo para simular o arquivo enviado pelo candidato.',
      ],
    });

    submission.pdfProjeto = projetoPdf.toString('base64');
    submission.pdfIdioma = idiomaPdf.toString('base64');
    submissionRepo.save(submission);

    fs.writeFileSync(path.join(outDir, `projeto-${submission.protocol}.pdf`), projetoPdf);
    fs.writeFileSync(path.join(outDir, `idioma-${submission.protocol}.pdf`), idiomaPdf);
  }

  // Criar 2 recursos para a 1ª inscrição (bypass do workflow, pois é seed interno)
  const targetSubmission = createdSubmissions[0];
  const appealsToCreate = [
    {
      protocolo_inscricao: targetSubmission.protocol,
      cpf: targetSubmission.identified?.cpf,
      nome: targetSubmission.identified?.nome,
      email: targetSubmission.identified?.email,
      etapa_processo: 'Inscrição',
      decisao_contestacao: 'Indeferimento preliminar (demo)',
      argumentacao: 'DEMO-SEED: Texto de exemplo de argumentação do recurso (Inscrição).',
    },
    {
      protocolo_inscricao: targetSubmission.protocol,
      cpf: targetSubmission.identified?.cpf,
      nome: targetSubmission.identified?.nome,
      email: targetSubmission.identified?.email,
      etapa_processo: 'Avaliação do Projeto',
      decisao_contestacao: 'Nota preliminar (demo)',
      argumentacao: 'DEMO-SEED: Texto de exemplo de argumentação do recurso (Avaliação do Projeto).',
    },
  ];

  const createdAppeals = [];
  for (const input of appealsToCreate) {
    const result = await registerAppeal.execute(input, { ip: '127.0.0.1', user: { username: 'demo-seed' }, userAgent: 'demo-seed' });
    const appeal = appealRepo.findByProtocol(result.protocol);
    createdAppeals.push(appeal);

    const pdf = await pdfService.generateAppealPdf(appeal, {
      ip: '127.0.0.1',
      user: { username: 'demo-seed' },
      userAgent: 'demo-seed',
      createdAt: appeal.createdAt,
    });

    const pdfPath = path.join(outDir, `recurso-${appeal.protocol}.pdf`);
    fs.writeFileSync(pdfPath, pdf);
  }

  // PDF de certificado (exemplo genérico)
  const certPdf = await pdfService.generateCertificatePdf(
    {
      nome: 'Participante Demo',
      cpf: '00000000000',
      curso: 'DEMO — Evento de Extensão',
      data: '20 de dezembro de 2025',
      cargaHoraria: '2 hora(s)',
      coordinator: 'Coordenação (demo)',
      department: 'Departamento (demo)',
      speakers: 'Palestrante (demo)',
      role: 'PARTICIPANTE',
      syllabus: 'Ementa demo',
      activities: [{ name: 'Atividade Demo', role: 'PARTICIPANTE', workload: 2 }],
    },
    { ip: '127.0.0.1', user: { username: 'demo-seed' }, userAgent: 'demo-seed', createdAt: new Date() }
  );
  const certPath = path.join(outDir, 'certificado-demo.pdf');
  fs.writeFileSync(certPath, certPdf);

  const summary = {
    generatedAt: new Date().toISOString(),
    outputs: {
      outDir: path.relative(repoRoot, outDir).replace(/\\/g, '/'),
      certificatePdf: path.relative(repoRoot, certPath).replace(/\\/g, '/'),
    },
    submissions: createdSubmissions.map((s) => ({
      protocol: s.protocol,
      cpfLast4: s.cpfLast4,
      cpf: s.identified?.cpf,
      email: s.identified?.email,
      pdf: `prints/demo/inscricao-${s.protocol}.pdf`,
      pdfProjeto: `prints/demo/projeto-${s.protocol}.pdf`,
      pdfIdioma: `prints/demo/idioma-${s.protocol}.pdf`,
    })),
    appeals: createdAppeals.map((a) => ({
      protocol: a.protocol,
      submissionProtocol: a.submissionProtocol,
      etapa: a.etapa,
      pdf: `prints/demo/recurso-${a.protocol}.pdf`,
    })),
  };

  const summaryPath = path.join(outDir, 'demo-summary.json');
  writeJson(summaryPath, summary);

  console.log('✅ Demo seed concluído.');
  console.log(`- PDFs em: ${path.relative(repoRoot, outDir)}`);
  console.log(`- Resumo: ${path.relative(repoRoot, summaryPath)}`);
  console.log('- Protocolos gerados:');
  for (const s of summary.submissions) console.log(`  - inscrição: ${s.protocol} (cpfLast4=${s.cpfLast4})`);
  for (const a of summary.appeals) console.log(`  - recurso: ${a.protocol} (inscrição=${a.submissionProtocol}, etapa=${a.etapa})`);
}

main().catch((err) => {
  console.error('❌ Falha no demo-seed:', err);
  process.exitCode = 1;
});
