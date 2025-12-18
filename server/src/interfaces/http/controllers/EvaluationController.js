class EvaluationController {
  constructor(submitEvaluationUseCase) {
    this.submitEvaluationUseCase = submitEvaluationUseCase;
  }

  async submit(req, res) {
    try {
      const protocol = req.params.protocol;
      // Extract scores from body (this mapping logic could be in a mapper/DTO)
      const evaluationData = {
        projectScores: {},
        interviewScores: {},
        languageScores: {},
        eliminado: req.body.eliminado === 'Sim',
        observacoes: req.body.observacoes
      };

      // Simple mapping for demo purposes - in real app use a proper mapper
      for (const [key, value] of Object.entries(req.body)) {
        if (key.startsWith('proj_')) evaluationData.projectScores[key] = value;
        if (key.startsWith('int_')) evaluationData.interviewScores[key] = value;
        if (key.startsWith('lang_')) evaluationData.languageScores[key] = value;
      }

      const result = await this.submitEvaluationUseCase.execute(protocol, evaluationData);
      return res.redirect('back'); // Or return JSON
    } catch (error) {
      return res.status(400).send(error.message);
    }
  }
}

module.exports = EvaluationController;
