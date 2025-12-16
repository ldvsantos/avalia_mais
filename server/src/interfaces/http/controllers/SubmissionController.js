const storage = require('../../../../storage');

class SubmissionController {
  constructor(registerSubmissionUseCase) {
    this.registerSubmissionUseCase = registerSubmissionUseCase;
  }

  async register(req, res) {
    try {
      // Enforce registration window
      if (!storage.isRegistrationOpen(new Date())) {
        return res.status(403).json({ error: 'Período de inscrições encerrado ou não iniciado.' });
      }
      const result = this.registerSubmissionUseCase.execute(req.body);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = SubmissionController;
