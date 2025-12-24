const VacancyAllocator = require('../server/vacancy_allocator');

// Dados simulados baseados na tabela fornecida
const candidatos = [
    { nome: "IATIARA CHAVES DE OLIVEIRA RIBEIRO", nota: 9.62, tags: ["Servidor_UEFS"] }, // UEFS tag adjusted
    { nome: "LEONARDO PEDREIRA DE OLIVEIRA", nota: 9.26, tags: ["Negro"] },
    { nome: "MICKAELLY ESPÍRITO SANTO SANTOS", nota: 9.26, tags: ["Negro"] },
    { nome: "MARILUCE SANTOS DA SILVA", nota: 9.06, tags: ["Negro"] },
    { nome: "CAMILA MENEZES SOUZA", nota: 9.04, tags: ["Negro"] },
    { nome: "TAÍNARA DA SILVA SANTOS", nota: 9.26, tags: ["Servidor_UEFS"] }, // UEFS tag adjusted
    { nome: "FERNANDA GONÇALVES DE BRITO", nota: 9.45, tags: [] }, // Ampla
    { nome: "FABIANA CALHEIRA MENEZES RIOS", nota: 9.45, tags: ["PCD"] },
    { nome: "RAFAEL CARLOMAGNO SILVA NOVAIS", nota: 8.74, tags: ["Termo_SDR"] },
    { nome: "MARIA CECÍLIA MOREIRA DOS REIS", nota: 8.60, tags: ["Termo_SDR"] },
    // Lista de Reserva
    { nome: "INEZ AZEVEDO CARVALHO", nota: 9.02, tags: [] },
    { nome: "ENILMA ARAÚJO FERREIRA", nota: 8.91, tags: [] },
    { nome: "GILDEMAR RIBEIRO LIMA JUNIOR", nota: 8.90, tags: [] },
    { nome: "HÁLIX JOAN ALMEIDA LIMA", nota: 8.91, tags: [] },
    { nome: "MARRÔSE SOUSA DA SILVA", nota: 8.78, tags: [] },
    { nome: "ERISVALDO MAURÍCIO DOS SANTOS", nota: 8.45, tags: [] },
    { nome: "RAIMUNDO JOSÉ FERREIRA DE JESUS", nota: 8.45, tags: [] },
    { nome: "FERNANDA MARQUES DANTAS", nota: 8.40, tags: [] },
    { nome: "FERNANDA PEDREIRA FIGUEREDO", nota: 8.26, tags: [] },
    { nome: "LUIS ORLANDO SOUZA LIMA", nota: 8.14, tags: [] },
    { nome: "SINTIA SOUZA FERNANDES SILVA", nota: 8.07, tags: [] },
    { nome: "CAMYLLA ELLEF MARTINS ALVES", nota: 7.75, tags: [] },
    { nome: "ADRIANA GUIMARÃES BARRETO", nota: 7.69, tags: [] },
    { nome: "ANA MARIA DE SOUZA BATISTA", nota: 7.71, tags: [] },
    { nome: "EDILEUSA SOUZA FERNANDES", nota: 7.72, tags: [] },
    { nome: "MILENA CARNEIRO MACEDO", nota: 7.37, tags: [] }
];

const totalVagas = 10;
const vagasExtras = { "Servidor_UEFS": 2, "Termo_SDR": 2 };

console.log("=== SMOKE TEST: ALOCAÇÃO DE VAGAS ===");
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

console.log("\n=== LISTA DE ESPERA (TOP 5) ===");
console.table(resultado.lista_espera.slice(0, 5).map(c => ({
    "Nome": c.nome,
    "Nota": c.nota,
    "Grupo": c.grupo_concorrencia,
    "Situação": c.situacao
})));
