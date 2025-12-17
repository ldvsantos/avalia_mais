class AppealController {
  constructor(registerAppealUseCase) {
    this.registerAppealUseCase = registerAppealUseCase;
  }

  async register(req, res) {
    try {
      const result = await this.registerAppealUseCase.execute(req.body);
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = AppealController;
