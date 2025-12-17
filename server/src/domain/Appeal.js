class Appeal {
  constructor({
    protocol,
    submissionProtocol,
    createdAt,
    cpf,
    nome,
    email,
    tituloProjeto,
    linhaPesquisa,
    etapa,
    decisaoContestacao,
    argumentacao,
    status = 'Recebido'
  }) {
    this.protocol = protocol;
    this.submissionProtocol = submissionProtocol;
    this.createdAt = createdAt;
    this.cpf = cpf;
    this.nome = nome;
    this.email = email;
    this.tituloProjeto = tituloProjeto;
    this.linhaPesquisa = linhaPesquisa;
    this.etapa = etapa;
    this.decisaoContestacao = decisaoContestacao;
    this.argumentacao = argumentacao;
    this.status = status;
  }
}

module.exports = Appeal;
