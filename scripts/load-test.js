/**
 * Load / Stress Test for avalia+Tec
 *
 * Uses autocannon (npm) to simulate concurrent users hitting the main
 * API endpoints. Run with:
 *
 *   node scripts/load-test.js [baseUrl] [duration] [connections]
 *
 * Defaults:
 *   baseUrl      = http://localhost:3000
 *   duration     = 30  (seconds)
 *   connections  = 100  (concurrent)
 *
 * Requires:  npm install -D autocannon
 *
 * Scenarios tested:
 *   1. GET  /api/verify/:protocol  — integrity verification (read-heavy)
 *   2. GET  /                      — static landing page
 *   3. POST /api/submissions       — submission creation (write-heavy)
 */

'use strict';

const autocannon = require('autocannon');

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const DURATION = parseInt(process.argv[3], 10) || 30;
const CONNECTIONS = parseInt(process.argv[4], 10) || 100;

// A dummy protocol to test the verify endpoint (should exist in the DB)
const TEST_PROTOCOL = process.env.TEST_PROTOCOL || 'PLANTERR-2025-TEST';

function fmt(result) {
  const r = result;
  return {
    title: r.title,
    url: r.url,
    connections: r.connections,
    duration: `${r.duration}s`,
    requests_total: r.requests.total,
    requests_per_sec_avg: r.requests.average,
    requests_per_sec_p50: r.requests.p50 || r.requests.median,
    latency_ms_avg: r.latency.average,
    latency_ms_p50: r.latency.p50 || r.latency.median,
    latency_ms_p95: r.latency.p95,
    latency_ms_p99: r.latency.p99,
    throughput_MB_per_sec: (r.throughput.average / 1024 / 1024).toFixed(2),
    errors: r.errors,
    timeouts: r.timeouts,
    non2xx: r.non2xx,
    '2xx': r['2xx'],
  };
}

async function runScenario(title, opts) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`  ${CONNECTIONS} concurrent connections × ${DURATION}s`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve, reject) => {
    const instance = autocannon({
      ...opts,
      duration: DURATION,
      connections: CONNECTIONS,
      title,
    }, (err, result) => {
      if (err) return reject(err);
      const summary = fmt(result);
      console.table(summary);
      resolve(summary);
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

async function main() {
  console.log(`\n  avalia+Tec Load Test`);
  console.log(`  Target: ${BASE_URL}`);
  console.log(`  Duration: ${DURATION}s  |  Connections: ${CONNECTIONS}\n`);

  const results = [];

  // Scenario 1: Static landing page
  results.push(await runScenario('GET / (landing page)', {
    url: BASE_URL + '/',
  }));

  // Scenario 2: Integrity verification endpoint
  results.push(await runScenario('GET /api/verify/:protocol', {
    url: BASE_URL + `/api/verify/${TEST_PROTOCOL}`,
  }));

  // Scenario 3: Submission creation (write-heavy)
  results.push(await runScenario('POST /api/inscricao (submission)', {
    url: BASE_URL + '/api/inscricao',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: 'Teste de Carga',
      cpf: `000.000.000-${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`,
      email: 'loadtest@example.com',
      titulo_pt: 'Projeto de Teste de Carga',
      area: 'Ciência da Computação',
      resumo: 'Submissão gerada automaticamente pelo teste de carga.',
    }),
    // Each request gets a unique CPF to avoid duplicate rejection
    setupClient(client) {
      let counter = 0;
      client.on('body', () => {});
      client.setBody(JSON.stringify({
        nome: 'Teste de Carga',
        cpf: `${String(Date.now()).slice(-9)}${String(counter++).padStart(2, '0')}`,
        email: 'loadtest@example.com',
        titulo_pt: 'Projeto de Teste de Carga',
        area: 'Ciência da Computação',
        resumo: 'Submissão gerada automaticamente pelo teste de carga.',
      }));
    },
  }));

  // Summary
  console.log('\n\n  ====== SUMMARY ======\n');
  console.table(results.map(r => ({
    scenario: r.title,
    'req/s': r.requests_per_sec_avg,
    'lat_p50 (ms)': r.latency_ms_p50,
    'lat_p95 (ms)': r.latency_ms_p95,
    'lat_p99 (ms)': r.latency_ms_p99,
    errors: r.errors,
  })));
}

main().catch(err => {
  console.error('Load test failed:', err);
  process.exit(1);
});
