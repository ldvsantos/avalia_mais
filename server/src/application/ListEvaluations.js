class ListEvaluations {
  constructor(evaluationRepository) {
    this.evaluationRepository = evaluationRepository;
  }

  async execute() {
    return await Promise.resolve(this.evaluationRepository.getAll());
  }
}

module.exports = ListEvaluations;
