class ListEvaluations {
  constructor(evaluationRepository) {
    this.evaluationRepository = evaluationRepository;
  }

  execute() {
    return this.evaluationRepository.getAll();
  }
}

module.exports = ListEvaluations;
