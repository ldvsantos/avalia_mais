const PlagiarismDetectorGateway = require('../../domain/gateways/PlagiarismDetectorGateway');

class MockPlagiarismAdapter extends PlagiarismDetectorGateway {
  async checkAiProbability(text) {
    console.log('[MockPlagiarismAdapter] Returning mock AI score');
    return 10; // Low risk
  }

  async checkPlagiarism(text, title) {
    console.log('[MockPlagiarismAdapter] Returning mock Plagiarism score');
    return {
      score: 5,
      reportUrl: 'http://mock-report.local',
      sources: ['http://mock-source.local'],
      matches: [],
      rawData: { mock: true }
    };
  }

  async checkReferences(referencesText) {
    console.log('[MockPlagiarismAdapter] Returning mock Reference analysis');
    return [
      { ref: "Mock Reference 1", status: "Real", reason: "Found in mock DB" },
      { ref: "Mock Reference 2", status: "Suspeita", reason: "Not found" }
    ];
  }
}

module.exports = MockPlagiarismAdapter;
