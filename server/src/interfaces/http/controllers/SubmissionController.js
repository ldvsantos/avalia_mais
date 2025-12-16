class SubmissionController {
  constructor(registerSubmissionUseCase) {
    this.registerSubmissionUseCase = registerSubmissionUseCase;
  }

  async register(req, res) {
    try {
      const result = this.registerSubmissionUseCase.execute(req.body);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = SubmissionController;
