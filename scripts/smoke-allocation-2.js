const VacancyAllocator = require('../server/vacancy_allocator');

// Dados simulados fornecidos pelo usuário
const candidatos = [
    { nome: "LUIS ANGELO CARNEIRO BAPTISTA", nota: 9.8, tags: [] },
    { nome: "THAYANE DOS SANTOS SALES SANTANA", nota: 8.47, tags: [] },
    { nome: "ROSITA BRASIL MAYAN GUERREIRO", nota: 8.65, tags: ["Termo_SDR"] },
    { nome: "NÍVEA OLIVEIRA SANTOS", nota: 8.17, tags: [] },
    { nome: "MATILDE SILVA CERQUEIRA SANTANA", nota: 8.58, tags: [] },
    { nome: "LUIZ EDUARDO LIMA CERQUEIRA", nota: 9.72, tags: [] },
    { nome: "LUCAS FERREIRA TAVARES", nota: 9.24, tags: ["Negro"] },
    { nome: "LAURINDO ALMEIDA LOPES NETO", nota: 9.70, tags: ["Negro"] },
    { nome: "JHON ALLAS SACRAMENTO PEREIRA", nota: 9.80, tags: ["Negro"] },
    { nome: "JÉSSICA MADEIRA DE OLIVEIRA", nota: 8.32, tags: [] },
    { nome: "GILMAR OLIVEIRA DA SILVA", nota: 8.15, tags: [] },
    { nome: "FABIANA MARQUES SANTOS", nota: 8.85, tags: [] },
    { nome: "BIANCA DOS SANTOS BARBOSA", nota: 9.19, tags: ["Negro"] }
];

const totalVagas = 10;
const vagasExtras = { "Servidor_UEFS": 2, "Termo_SDR": 2 };

console.log("=== SMOKE TEST 2: NOVA LISTA ===");
console.log(`Total Vagas: ${totalVagas}`);
console.log(`Vagas Extras: ${JSON.stringify(vagasExtras)}`);

const allocator = new VacancyAllocator(totalVagas, candidatos, vagasExtras);
const resultado = allocator.distribuir();

console.log("\n=== QUADRO DE VAGAS CALCULADO ===");
console.log(JSON.stringify(resultado.quadro_vagas_calculado, null, 2));

console.log("\n=== RESULTADO FINAL (APROVADOS) ===");
console.table(resultado.aprovados.map(c => ({
    "Nome": c.nome,
    "Nota": c.nota,
    "Grupo": c.grupo_concorrencia,
    "Situação": c.situacao
})));

console.log("\n=== LISTA DE ESPERA ===");
console.table(resultado.lista_espera.map(c => ({
    "Nome": c.nome,
    "Nota": c.nota,
    "Grupo": c.grupo_concorrencia,
    "Situação": c.situacao
})));
