const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const pdfParse = require('pdf-parse');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function normalizeCellValue(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString();

  // ExcelJS pode retornar objetos (richText, hyperlink, formula, etc.)
  if (typeof v === 'object') {
    if (typeof v.text === 'string') return v.text;
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text || '').join('');
    if (typeof v.result === 'string' || typeof v.result === 'number') return v.result;
    if (typeof v.hyperlink === 'string') return v.text || v.hyperlink;
    if (typeof v.formula === 'string') return v.result != null ? v.result : v.formula;
  }

  return String(v);
}

async function safeReadXlsx(file) {
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);

    const sheets = (wb.worksheets || []).map(ws => {
      const rows = [];
      ws.eachRow({ includeEmpty: true }, (row) => {
        // row.values é 1-based; remove o primeiro elemento vazio
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        rows.push(values.map(normalizeCellValue));
      });
      return { name: ws.name, rows };
    });

    return sheets;
  } catch (e) {
    return { error: String(e.message || e) };
  }
}

async function safeReadPdf(file) {
  try {
    const data = fs.readFileSync(file);
    const parsed = await pdfParse(data);
    return parsed.text;
  } catch (e) {
    return `ERROR: ${String(e.message || e)}`;
  }
}

function extractFromFichaProjeto(sheets) {
  const criteria = [];
  const rangeHints = [];
  sheets.forEach(sheet => {
    const rows = sheet.rows || [];
    rows.forEach((row, rIdx) => {
      const cells = row.map(v => String(v || '').trim());
      const line = cells.join(' | ');
      // Heurística: linhas com critério e máximo
      const m = line.match(/(\b[0-9]{1,3}\b)\s*\/?\s*(pontos|pts)/i);
      if (m) {
        criteria.push({ sheet: sheet.name, row: rIdx + 1, text: line });
      }
      const r = line.match(/(0\s*-\s*100|0\s*a\s*100|min\.?\s*\d+|max\.?\s*\d+)/i);
      if (r) rangeHints.push({ sheet: sheet.name, row: rIdx + 1, text: line });
    });
  });
  return { criteria, rangeHints };
}

function extractFromDemaisFases(sheets) {
  const interview = [];
  const curriculum = [];
  sheets.forEach(sheet => {
    const rows = sheet.rows || [];
    rows.forEach((row, rIdx) => {
      const line = row.map(v => String(v || '').trim()).join(' | ');
      if (/entrevista/i.test(line)) interview.push({ sheet: sheet.name, row: rIdx + 1, text: line });
      if (/curr[ií]culo|lattes|produção|experiência/i.test(line)) curriculum.push({ sheet: sheet.name, row: rIdx + 1, text: line });
    });
  });
  return { interview, curriculum };
}

function extractWeightsFromText(text) {
  const weights = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((l, i) => {
    const line = l.trim();
    const m = line.match(/(projeto|anteprojeto|entrevista|curr[ií]culo|an[aá]lise)\D{0,20}(\b\d{1,3})\s*%/i);
    if (m) {
      weights.push({ line: i + 1, text: line });
    }
    const elim = line.match(/eliminat[óo]ria|desclassifica|exclu[ií]do|pl[aá]gio|n[aã]o comparecimento/i);
    if (elim) weights.push({ line: i + 1, text: line, type: 'eliminatory' });
    const tie = line.match(/desempate|cr[ií]terios de desempate|em caso de empate/i);
    if (tie) weights.push({ line: i + 1, text: line, type: 'tie' });
    const quota = line.match(/cotas|ações afirmativas|vagas reservadas|PcD|negro|ind[ií]gena|quilombola|trans/i);
    if (quota) weights.push({ line: i + 1, text: line, type: 'quota' });
  });
  return weights;
}

function extractLanguageExamInfo(text) {
  const info = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((l, i) => {
    const line = l.trim();
    if (/prova\s+de\s+língua|prova\s+de\s+lingua|língua\s+estrangeira/i.test(line)) {
      const perc = line.match(/(\d{1,3})\s*%/g);
      const pts = line.match(/(\b\d{1,2}(?:,[0-9]+)?)\s+pontos?/i);
      info.push({ line: i + 1, text: line, perc, pts });
    }
  });
  return info;
}

async function main() {
  const out = { projectCriteria: null, otherPhases: null, edital: null };

  const fichaProjetoXlsx = path.join(TEMPLATES_DIR, 'FICHA_AVALIACAO_PROJETO.xlsx');
  const demaisFasesXlsx = path.join(TEMPLATES_DIR, 'FICHAS_DEMAIS_FASES.xlsx');
  const editalPdf = path.join(TEMPLATES_DIR, 'EDITAL DE SELEÇÃO PARA ALUNO REGULAR PLANTERR 2026 - VF.pdf');

  if (fs.existsSync(fichaProjetoXlsx)) {
    const sheets = await safeReadXlsx(fichaProjetoXlsx);
    out.projectCriteria = extractFromFichaProjeto(sheets);
  } else {
    out.projectCriteria = { error: 'Arquivo não encontrado' };
  }

  if (fs.existsSync(demaisFasesXlsx)) {
    const sheets = await safeReadXlsx(demaisFasesXlsx);
    out.otherPhases = extractFromDemaisFases(sheets);
  } else {
    out.otherPhases = { error: 'Arquivo não encontrado' };
  }

  if (fs.existsSync(editalPdf)) {
    const text = await safeReadPdf(editalPdf);
    out.edital = { weightsAndRules: extractWeightsFromText(text), languageExam: extractLanguageExamInfo(text) };
  } else {
    out.edital = { error: 'Arquivo não encontrado' };
  }

  const summaryPath = path.join(TEMPLATES_DIR, 'extracted_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Resumo gerado em:', summaryPath);
}

main().catch(err => {
  console.error('Falha na extração:', err);
  process.exit(1);
});
