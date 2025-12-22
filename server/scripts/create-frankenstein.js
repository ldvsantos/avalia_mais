
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const JsonSubmissionRepository = require('../src/infrastructure/repositories/JsonSubmissionRepository');

const dataDir = path.join(__dirname, '..', 'data');
const submissionRepo = new JsonSubmissionRepository(dataDir);

async function createFrankenstein() {
  console.log('Criando submissão Frankenstein...');

  const protocol = 'FRANKENSTEIN-2025';
  
  // Dados do Candidato (Fictício)
  const candidate = {
    nome: 'Dr. Victor Frankenstein',
    nome_social: '',
    cpf: '17073682019',
    rg: '00000000',
    orgao_expedidor: 'SSP/BA',
    data_expedicao: '2000-01-01',
    data_nascimento: '1990-01-01',
    email: 'victor.frankenstein@example.com',
    celular: '75999999999',
    telefone_residencial: '',
    endereco: 'Rua dos Bobos, 0',
    cidade_estado: 'Feira de Santana/BA',
    cep: '44000-000',
    curso_graduacao: 'Engenharia de Criação',
    instituicao: 'Universidade de Ingolstadt',
    ano_conclusao: '2015',
    vaga_institucional: 'nao',
    cotas: 'nao',
    deficiencia: 'nao'
  };

  // Projeto Frankenstein
  // Mistura de IA, Plágio e Alucinações
  const project = {
    area: 'Linha de Pesquisa 1: Planejamento e Gestão Territorial',
    titulo_pt: 'Impactos da Inteligência Artificial na Agricultura Sustentável: Uma Revisão Sistemática',
    titulo_en: 'Impacts of Artificial Intelligence on Sustainable Agriculture: A Systematic Review',
    palavras_pt: 'Inteligência Artificial; Agricultura; Sustentabilidade',
    palavras_en: 'Artificial Intelligence; Agriculture; Sustainability',
    
    // IA (Texto genérico gerado por LLM)
    resumo: 'Este trabalho apresenta uma análise sobre a integração da inteligência artificial na agricultura moderna. A IA tem o potencial de transformar a maneira como os alimentos são produzidos, aumentando a eficiência e reduzindo o desperdício. Através de algoritmos de aprendizado de máquina, é possível prever safras, monitorar pragas e otimizar a irrigação. O estudo conclui que a adoção dessas tecnologias é crucial para a segurança alimentar global.',
    
    justificativa_enquadramento: 'O projeto se enquadra na linha de pesquisa ao propor ferramentas de gestão territorial baseadas em dados.',
    
    // IA
    introducao: 'A inteligência artificial (IA) tem revolucionado diversos setores da economia global, e a agricultura não é exceção. Com o advento de tecnologias avançadas, como aprendizado de máquina e visão computacional, os produtores rurais têm acesso a ferramentas que otimizam o uso de recursos, aumentam a produtividade e reduzem o impacto ambiental. Este trabalho visa explorar como essas tecnologias estão sendo implementadas no campo brasileiro, focando especificamente na agricultura familiar e no agronegócio de larga escala.',
    
    // Plágio (Definição comum de Agricultura de Precisão - Wikipedia/Embrapa style)
    problema_pesquisa: 'A agricultura de precisão é um sistema de gerenciamento agrícola baseado na variação espacial e temporal da unidade produtiva e visa à otimização do retorno econômico e à minimização do impacto ambiental. O problema reside na falta de adoção dessas tecnologias por pequenos produtores devido ao alto custo inicial e à falta de conhecimento técnico.',
    
    justificativa_relevancia: 'A relevância deste estudo se dá pela necessidade urgente de aumentar a produção de alimentos sem expandir a fronteira agrícola, preservando assim os biomas nativos.',
    
    objetivo_geral: 'Analisar o impacto das tecnologias de IA na sustentabilidade agrícola.',
    
    objetivos_especificos: '- Mapear as principais ferramentas de IA utilizadas no Brasil.\n- Identificar barreiras para a adoção tecnológica.\n- Propor um modelo de baixo custo para pequenos agricultores.',
    
    revisao_literatura: 'A literatura aponta que a agricultura 4.0 é caracterizada pela digitalização dos processos. Segundo diversos autores, a conectividade no campo é o principal gargalo para o avanço dessas tecnologias.',
    
    procedimentos_metodologicos: 'Será realizada uma revisão sistemática da literatura nas bases de dados Scopus e Web of Science, cobrindo o período de 2015 a 2025.',
    
    cronograma: 'Mês 1-3: Revisão Bibliográfica.\nMês 4-6: Coleta de Dados.\nMês 7-12: Análise e Redação.',
    
    // Alucinações (Referências Falsas misturadas com reais genéricas)
    referencias: `Silva, J. P., & Oliveira, M. R. (2024). O uso de drones na agricultura 5.0: Um estudo de caso no oeste baiano. Revista Brasileira de Tecnologia Agrícola, 12(3), 45-60.

OpenAI. (2023). ChatGPT: Optimizing Soy Crops in Brazil through Generative AI. Tech Report 2023. San Francisco: OpenAI Press.

Embrapa. (2020). Visão 2030: o futuro da agricultura brasileira. Brasília: Embrapa.

Santos, A. B. (2022). A revolução silenciosa: como a IA vai substituir o agrônomo. Editora do Campo Fictício.

Molin, J. P. (2015). Agricultura de precisão. In: Tecnologias para a agricultura. Piracicaba: ESALQ.`
  };

  const submission = {
    id: crypto.randomUUID(),
    protocol: protocol,
    cpfHash: crypto.createHash('sha256').update(candidate.cpf).digest('hex'),
    identified: candidate,
    project: project,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'submitted',
    integrity: {
        status: 'not_scanned' // Força o estado inicial para permitir o scan
    }
  };

  await submissionRepo.save(submission);
  console.log(`Submissão ${protocol} criada com sucesso!`);
  console.log('Acesse como Avaliador da Linha 1 para testar.');
}

createFrankenstein().catch(console.error);
