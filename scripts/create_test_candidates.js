const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Paths
const DATA_DIR = path.join(__dirname, '..', 'server', 'data');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');
const EVALUATIONS_FILE = path.join(DATA_DIR, 'evaluations.json');

// Helper to read JSON
function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
    return null;
  }
}

// Helper to write JSON
function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Generate a random protocol
function generateProtocol() {
  return 'TEST-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Generate random candidates
function generateCandidates(count, linha) {
  const candidates = [];
  const quotas = ['negro', 'indigena', 'deficiente', 'trans', 'servidor_uefs', 'termo_sdr'];
  
  for (let i = 0; i < count; i++) {
    const protocol = generateProtocol();
    const isCota = Math.random() > 0.5;
    const selectedQuotas = [];
    
    if (isCota) {
      // Pick 1 or 2 random quotas
      const q1 = quotas[Math.floor(Math.random() * quotas.length)];
      selectedQuotas.push(q1);
      if (Math.random() > 0.7) {
        const q2 = quotas[Math.floor(Math.random() * quotas.length)];
        if (q2 !== q1) selectedQuotas.push(q2);
      }
    }

    candidates.push({
      protocol,
      cpfHash: crypto.createHash('sha256').update(protocol).digest('hex'),
      identified: {
        nome: `Candidato Teste ${linha} ${i+1} (${selectedQuotas.join(', ') || 'Ampla'})`,
        email: `teste.${protocol.toLowerCase()}@example.com`,
        cpf: '000.000.000-00'
      },
      formData: {
        linha_pesquisa: linha === 1 ? 'Linha 1 - Planejamento' : 'Linha 2 - Território',
        cotas: selectedQuotas
      },
      createdAt: new Date().toISOString(),
      audit: {
        history: [{ action: 'create', at: new Date().toISOString(), actor: { type: 'script' } }]
      }
    });
  }
  return candidates;
}

// Generate evaluations for candidates
function generateEvaluations(candidates) {
  const evaluations = [];
  for (const c of candidates) {
    // Generate a random score between 5.0 and 10.0
    const score = (Math.random() * 5 + 5).toFixed(2);
    evaluations.push({
      protocol: c.protocol,
      evaluator: 'script-evaluator',
      score: parseFloat(score),
      status: 'approved', // or whatever the status field is
      createdAt: new Date().toISOString()
    });
  }
  return evaluations;
}

async function main() {
  console.log('Generating test data...');
  
  // Generate 15 candidates for Line 1
  const candidatesL1 = generateCandidates(15, 1);
  // Generate 15 candidates for Line 2
  const candidatesL2 = generateCandidates(15, 2);
  
  const allCandidates = [...candidatesL1, ...candidatesL2];
  const allEvaluations = generateEvaluations(allCandidates);
  
  console.log(`Generated ${allCandidates.length} candidates and evaluations.`);

  // Read existing data
  const submissionsData = readJson(SUBMISSIONS_FILE) || { submissions: [] };
  const evaluationsData = readJson(EVALUATIONS_FILE) || { evaluations: [] };

  // Append
  submissionsData.submissions.push(...allCandidates);
  
  // Handle evaluations structure (it might be an array or object with evaluations key)
  let evList = [];
  if (Array.isArray(evaluationsData)) {
    evList = evaluationsData;
  } else if (Array.isArray(evaluationsData.evaluations)) {
    evList = evaluationsData.evaluations;
  }
  
  evList.push(...allEvaluations);
  
  // Write back
  // Backup first?
  fs.copyFileSync(SUBMISSIONS_FILE, SUBMISSIONS_FILE + '.bak-test');
  fs.copyFileSync(EVALUATIONS_FILE, EVALUATIONS_FILE + '.bak-test');
  
  writeJson(SUBMISSIONS_FILE, submissionsData);
  
  if (Array.isArray(evaluationsData)) {
    writeJson(EVALUATIONS_FILE, evList);
  } else {
    evaluationsData.evaluations = evList;
    writeJson(EVALUATIONS_FILE, evaluationsData);
  }
  
  console.log('Test data injected successfully.');
  console.log('Backups created with .bak-test extension.');
}

main();
