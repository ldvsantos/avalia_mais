class ProcessIntegrityWebhook {
  constructor(submissionRepository, integrityService) {
    this.submissionRepository = submissionRepository;
    this.integrityService = integrityService;
  }

  async execute(payload) {
    const data = await this.integrityService.processWebhook(payload);
    const { submissionId, score, aiScore, reportUrl, status } = data;

    const submission = await this.submissionRepository.findByProtocol(submissionId);
    if (!submission) {
      throw new Error('Submission not found for webhook');
    }

    submission.integrity = {
        status: status || 'completed',
        score,
        aiScore,
        reportUrl,
        scanId: submission.integrity?.scanId,
        updatedAt: new Date().toISOString()
    };

    await this.submissionRepository.save(submission);
    return submission;
  }
}

module.exports = ProcessIntegrityWebhook;
