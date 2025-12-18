const Evaluation = require('../domain/Evaluation');

class SubmitEvaluation {
  constructor(evaluationRepository, submissionRepository, workflowService) {
    this.evaluationRepository = evaluationRepository;
    this.submissionRepository = submissionRepository;
    this.workflowService = workflowService;
  }

  execute(protocol, evaluationData) {
    // 1. Check if submission exists
    const submission = this.submissionRepository.findByProtocol(protocol);
    if (!submission) {
      throw new Error('Inscrição não encontrada');
    }

    // 1.1 Workflow gating por fase (somente se houver dados sendo enviados)
    const now = new Date();
    if (this.workflowService && typeof this.workflowService.assertCanEvaluatePhase === 'function') {
      const hasAnyProject = evaluationData?.projectScores && Object.keys(evaluationData.projectScores).length > 0;
      const hasAnyInterview = evaluationData?.interviewScores && Object.keys(evaluationData.interviewScores).length > 0;
      const hasAnyLanguage = evaluationData?.languageScores && Object.keys(evaluationData.languageScores).length > 0;

      if (hasAnyProject) this.workflowService.assertCanEvaluatePhase({ submissionProtocol: protocol, phaseKey: 'PROJETO', now });
      if (hasAnyInterview) this.workflowService.assertCanEvaluatePhase({ submissionProtocol: protocol, phaseKey: 'ENTREVISTA', now });
      if (hasAnyLanguage) this.workflowService.assertCanEvaluatePhase({ submissionProtocol: protocol, phaseKey: 'LINGUA', now });
    }

    // 2. Get existing evaluation or create new
    let evaluation = this.evaluationRepository.findByProtocol(protocol);
    if (!evaluation) {
      evaluation = new Evaluation({ protocol });
    }

    // 3. Update scores
    // Merge new scores into existing ones
    evaluation.projectScores = { ...evaluation.projectScores, ...evaluationData.projectScores };
    evaluation.interviewScores = { ...evaluation.interviewScores, ...evaluationData.interviewScores };
    evaluation.languageScores = { ...evaluation.languageScores, ...evaluationData.languageScores };
    
    if (evaluationData.eliminado !== undefined) evaluation.eliminado = evaluationData.eliminado;
    if (evaluationData.observacoes !== undefined) evaluation.observacoes = evaluationData.observacoes;

    // 4. Recalculate totals
    evaluation.calculateFinalScores();
    evaluation.updatedAt = new Date().toISOString();

    // 5. Save
    this.evaluationRepository.save(evaluation);

    // 6. Update submission status if needed (e.g. if eliminated)
    if (evaluation.eliminado) {
      submission.updateStatus('Indeferido');
      this.submissionRepository.save(submission);
    }

    // 6. Atualiza status por fase (nota de corte 7.0)
    if (this.workflowService && typeof this.workflowService.applyCutoffAndPersist === 'function') {
      const year = this.workflowService.getEditalYearForSubmission(protocol);
      if (evaluation.proj_total != null) {
        this.workflowService.applyCutoffAndPersist({ year, submissionProtocol: protocol, phaseKey: 'PROJETO', score: evaluation.proj_total });
      }
      if (evaluation.int_total != null) {
        this.workflowService.applyCutoffAndPersist({ year, submissionProtocol: protocol, phaseKey: 'ENTREVISTA', score: evaluation.int_total });
      }
      if (evaluation.lang_total != null) {
        this.workflowService.applyCutoffAndPersist({ year, submissionProtocol: protocol, phaseKey: 'LINGUA', score: evaluation.lang_total });
      }
    }

    return evaluation;
  }
}

module.exports = SubmitEvaluation;
