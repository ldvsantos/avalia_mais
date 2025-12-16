const Evaluation = require('../domain/Evaluation');

class SubmitEvaluation {
  constructor(evaluationRepository, submissionRepository) {
    this.evaluationRepository = evaluationRepository;
    this.submissionRepository = submissionRepository;
  }

  execute(protocol, evaluationData) {
    // 1. Check if submission exists
    const submission = this.submissionRepository.findByProtocol(protocol);
    if (!submission) {
      throw new Error('Inscrição não encontrada');
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

    return evaluation;
  }
}

module.exports = SubmitEvaluation;
