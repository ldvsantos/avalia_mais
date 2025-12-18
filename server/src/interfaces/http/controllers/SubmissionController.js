const storage = require('../../../../storage');

class SubmissionController {
  constructor(registerSubmissionUseCase, workflowService) {
    this.registerSubmissionUseCase = registerSubmissionUseCase;
    this.workflowService = workflowService;
  }

  async register(req, res) {
    try {
      // Enforce registration window (novo workflow, com fallback compat)
      const now = new Date();
      if (this.workflowService && typeof this.workflowService.assertCanRegisterSubmission === 'function') {
        try {
          this.workflowService.assertCanRegisterSubmission(now);
        } catch (err) {
          return res.status(403).json({ error: err.message || 'Período de inscrições encerrado ou não iniciado.' });
        }
      } else {
        if (!storage.isRegistrationOpen(now)) {
          return res.status(403).json({ error: 'Período de inscrições encerrado ou não iniciado.' });
        }
      }
      const result = await this.registerSubmissionUseCase.execute(req.body);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = SubmissionController;
