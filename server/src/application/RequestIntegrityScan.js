class RequestIntegrityScan {
  constructor(submissionRepository, integrityService) {
    this.submissionRepository = submissionRepository;
    this.integrityService = integrityService;
  }

  async execute(protocol) {
    const submission = await this.submissionRepository.findByProtocol(protocol);
    if (!submission) {
      throw new Error('Submission not found');
    }

    // Extract text from project
    // Mapping fields based on the actual form structure (PT-BR)
    const project = submission.project || {};
    const textToScan = [
      project.titulo_pt,
      project.resumo,
      project.introducao,
      project.problema_pesquisa,
      project.justificativa_relevancia,
      project.objetivo_geral,
      project.objetivos_especificos,
      project.revisao_literatura,
      project.procedimentos_metodologicos,
      // project.referencias // Excluded from main scan to avoid false positives
    ].filter(Boolean).join('\n\n');

    const references = project.referencias || '';

    if (!textToScan || textToScan.length < 50) {
       // Fallback: try to dump all values if specific fields are missing (legacy support)
       const fallbackText = Object.values(project).filter(v => typeof v === 'string' && v.length > 20).join('\n\n');
       if (fallbackText.length >= 50) {
           return this._proceedWithScan(protocol, submission, fallbackText, project.titulo_pt, references);
       }
       throw new Error('Not enough text to scan (minimum 50 chars). Verifique se o projeto tem conteúdo preenchido.');
    }

    const title = project.titulo_pt || `Project ${protocol}`;
    return this._proceedWithScan(protocol, submission, textToScan, title, references);
  }

  async _proceedWithScan(protocol, submission, text, title, references) {
    const result = await this.integrityService.analyzeProject(protocol, text, title, references);
    
    // Update submission status
    submission.integrity = {
        ...submission.integrity,
        status: result.status,
        scanId: result.scanId,
        score: result.score,
        aiScore: result.aiScore,
        reportUrl: result.reportUrl,
        sources: result.sources,
        matches: result.matches,
        referenceAnalysis: result.referenceAnalysis, // New field
        message: result.message,
        interpretation: result.interpretation,
        scannedText: text, // Save the exact text used for scanning
        updatedAt: new Date().toISOString()
    };

    await this.submissionRepository.save(submission);
    return result;
  }
}

module.exports = RequestIntegrityScan;
