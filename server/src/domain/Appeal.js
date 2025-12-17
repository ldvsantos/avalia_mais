class Appeal {
  constructor({
    protocol,
    createdAt,
    cpf,
    nome,
    email,
    tituloProjeto,
    linhaPesquisa,
    etapa,
    argumentacao,
    status = 'Recebido'
  }) {
    this.protocol = protocol;
    this.createdAt = createdAt;
    this.cpf = cpf;
    this.nome = nome;
    this.email = email;
    this.tituloProjeto = tituloProjeto;
    this.linhaPesquisa = linhaPesquisa;
    this.etapa = etapa;
    this.argumentacao = argumentacao;
    this.status = status;
  }
}

module.exports = Appeal;
