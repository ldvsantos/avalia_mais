class Evaluation {
  constructor(data) {
    this.protocol = data.protocol;
    this.projectScores = data.projectScores || {};
    this.interviewScores = data.interviewScores || {};
    this.languageScores = data.languageScores || {};
    
    this.proj_total = data.proj_total || 0;
    this.int_total = data.int_total || 0;
    this.lang_total = data.lang_total || 0;

    this.eliminado = data.eliminado || false;
    this.observacoes = data.observacoes || '';
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  calculateFinalScores() {
    const evaluators = ['avaliador1', 'avaliador2', 'avaliador3'];
    
    // Project Calculation
    const projectKeys = ['proj_intro', 'proj_problem', 'proj_just', 'proj_objectives', 'proj_review', 'proj_methods', 'proj_schedule', 'proj_refs'];
    const projEvaluatorSums = evaluators.map(who => {
      return projectKeys.reduce((sum, k) => {
        return sum + (Number(this.projectScores[`proj_${who}_${k}`]) || 0);
      }, 0);
    });
    this.proj_total = projEvaluatorSums.reduce((a, b) => a + b, 0) / 3;

    // Interview Calculation
    const intEvaluatorSums = evaluators.map(who => {
      const prefix = `int_${who}`;
      const ap = Number(this.interviewScores[`${prefix}_apresentacao`]) || 0;
      const hp = Number(this.interviewScores[`${prefix}_historico`]) || 0;
      const df = Number(this.interviewScores[`${prefix}_defesa`]) || 0;
      const ji = Number(this.interviewScores[`${prefix}_justificativa`]) || 0;
      return ap + hp + df + ji;
    });
    this.int_total = intEvaluatorSums.reduce((a, b) => a + b, 0) / 3;

    // Language Calculation
    const langEvaluatorSums = evaluators.map(who => {
      const prefix = `lang_${who}`;
      const c = Number(this.languageScores[`${prefix}_clareza`]) || 0;
      const d = Number(this.languageScores[`${prefix}_domino`]) || 0;
      const a = Number(this.languageScores[`${prefix}_analise`]) || 0;
      return (c * 0.3) + (d * 0.4) + (a * 0.3);
    });
    this.lang_total = langEvaluatorSums.reduce((a, b) => a + b, 0) / 3;
  }
}

module.exports = Evaluation;
