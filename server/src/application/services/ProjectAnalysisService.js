class ProjectAnalysisService {
    /**
     * @param {import('../../domain/gateways/PlagiarismDetectorGateway')} plagiarismDetector 
     */
    constructor(plagiarismDetector) {
      this.plagiarismDetector = plagiarismDetector;
    }
  
    /**
     * Orchestrates the scan (AI + Plagiarism + Reference Check)
     * @param {string} submissionId 
     * @param {string} text 
     * @param {string} title 
     * @param {string} references (Optional)
     */
    async analyzeProject(submissionId, text, title = 'Untitled', references = '') {
      console.log(`[ProjectAnalysisService] Analyzing project ${submissionId}...`);
  
      // 1. Check AI Probability
      let aiScore = null;
      let errors = [];
      
      try {
        aiScore = await this.plagiarismDetector.checkAiProbability(text);
      } catch (err) {
        console.error(`[ProjectAnalysisService] AI Detection failed for ${submissionId}:`, err.message);
        errors.push(`AI: ${err.message}`);
      }
  
      // 2. Check Plagiarism
      let plagiarismScore = null;
      let reportUrl = null;
      let sources = [];
      let matches = [];
      let rawData = null;
  
      try {
        const plagResult = await this.plagiarismDetector.checkPlagiarism(text, title);
        plagiarismScore = plagResult.score;
        reportUrl = plagResult.reportUrl;
        sources = plagResult.sources || [];
        matches = plagResult.matches || [];
        rawData = plagResult.rawData;
      } catch (err) {
        console.error(`[ProjectAnalysisService] Plagiarism Detection failed for ${submissionId}:`, err.message);
        errors.push(`Plag: ${err.message}`);
      }
  
      // 3. Check References (Hallucination Detection)
      let referenceAnalysis = null;
      if (references && references.length > 20) {
          try {
              referenceAnalysis = await this.plagiarismDetector.checkReferences(references);
          } catch (err) {
              console.error(`[ProjectAnalysisService] Reference Check failed for ${submissionId}:`, err.message);
              errors.push(`RefCheck: ${err.message}`);
          }
      }
  
      const status = (aiScore === null && plagiarismScore === null) ? 'error' : 'completed';
      let message = errors.length > 0 ? errors.join(' | ') : 'Scan completed successfully';
      
      // Generate Interpretation Report (Business Logic)
      const interpretation = this._getInterpretation(aiScore, plagiarismScore);
  
      // Log high risk events
      if (interpretation.color === 'red') {
          console.warn(`[ProjectAnalysisService] High Risk detected for ${submissionId}: AI=${aiScore}, Plag=${plagiarismScore}`);
      }
  
      return {
        scanId: `scan_${Date.now()}`,
        status: status,
        score: plagiarismScore,
        aiScore: aiScore,
        reportUrl: reportUrl,
        sources: sources,
        matches: matches,
        referenceAnalysis: referenceAnalysis,
        scannedText: text,
        message: message,
        interpretation: interpretation,
        raw_report_data: rawData // Storing raw JSON as requested
      };
    }
  
    _getInterpretation(aiScore, plagiarismScore) {
      // Default safe values
      let label = 'Baixo Risco';
      let color = 'green';
      let text = 'Dentro da normalidade. Provável uso apenas de corretores ortográficos (Grammarly/Editor).';
  
      // Logic based on AI Score (0-100)
      const safeAi = aiScore || 0;
      const safePlag = plagiarismScore || 0;
  
      if (safeAi > 50) {
        label = 'Alto Risco de Autoria Sintética';
        color = 'red';
        text = `Score de IA (${safeAi}%) acima do limiar de 50%. Estatisticamente, isso indica que a maior parte da estrutura sintática e argumentativa foi gerada por modelos de linguagem (LLMs), e não apenas revisada.`;
      } else if (safeAi > 15) {
        label = 'Nível de Atenção';
        color = 'orange';
        text = `Score de IA (${safeAi}%) na faixa de incerteza (15-50%). Indica possível edição híbrida ou uso intenso de ferramentas de reescrita (paráfrase). Requer análise humana detalhada.`;
      }
  
      // Plagiarism Context
      if (safePlag > 20) {
          if (color === 'red') {
              label = 'Alto Risco (IA + Plágio)';
              text += ` ALERTA CRÍTICO: Também foi detectado ${safePlag}% de plágio (acima do limite de 20%). Verifique o Relatório Completo para ver os trechos copiados.`;
          } else {
              label = 'Risco de Plágio';
              color = 'red';
              text = `Atenção: Índice de plágio de ${safePlag}% excede o limite de segurança (20%). Verifique o Relatório Completo para identificar os trechos copiados e suas fontes.`;
          }
      }
  
      return {
          status_label: label,
          color: color,
          explanation_text: text
      };
    }
  }
  
  module.exports = ProjectAnalysisService;
  