class AppealController {
  constructor(registerAppealUseCase, workflowService) {
    this.registerAppealUseCase = registerAppealUseCase;
    this.workflowService = workflowService;
  }

  async register(req, res) {
    try {
      // Bloqueios de prazo/status (workflow) antes de criar o recurso
      if (this.workflowService && typeof this.workflowService.assertCanSubmitAppeal === 'function') {
        const submissionProtocol = String(req.body?.protocolo_inscricao || req.body?.submissionProtocol || '').trim();
        const etapaLabel = String(req.body?.etapa_processo || '').trim();
        try {
          await this.workflowService.assertCanSubmitAppeal({ submissionProtocol, etapaLabel, now: new Date() });
        } catch (err) {
          return res.status(403).json({ error: err.message || 'Recurso bloqueado pelo workflow.' });
        }
      }

      const result = await this.registerAppealUseCase.execute(req.body, {
        ip: req.ip,
        user: req.user,
        userAgent: req.get('User-Agent')
      });
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

module.exports = AppealController;
