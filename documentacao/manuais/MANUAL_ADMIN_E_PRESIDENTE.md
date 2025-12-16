---
title: "Manual da Área Restrita — Sistema PLANTERR"
subtitle: "Administrador Geral e Presidente da Banca"
author: "Equipe de Desenvolvimento"
date: "16/12/2025"
lang: "pt-BR"
toc: true
toc-depth: 3
number-sections: true
geometry: "margin=2.5cm"
---

**Versão:** 1.1  
**Atualizado em:** 16/12/2025

---

## 1. APRESENTAÇÃO

Este manual é destinado a usuários da **área restrita** do Sistema AVALIA+. O conteúdo cobre o trabalho do **Administrador Geral** (gestão de inscrições, relatórios e credenciais) e do **Presidente da Banca** (comissão, consolidação e resultados).

## 2. ACESSO À ÁREA RESTRITA

O acesso à área restrita é feito por um endereço específico (fornecido pela coordenação), que inclui um código de segurança na URL. Ao abrir o link, você verá a tela de login com o campo para informar seu usuário.

Figura 01 — Tela de login do Admin: URL/campo "Usuário"

![](../../prints/manual/fig-01-login-admin-tela.png){width=75%}

Informe seu **usuário** e, em seguida, sua **senha** nos campos indicados. Os dois campos devem ser preenchidos com as credenciais fornecidas pela coordenação.

Figura 02 — Login do Admin: campos "Usuário" e "Senha"

![](../../prints/manual/fig-02-login-admin-campos.png){width=75%}

Depois de preencher ambos os campos, finalize clicando no botão **Entrar** para acessar o painel administrativo.

Figura 03 — Login do Admin: botão "Entrar"

![](../../prints/manual/fig-03-login-admin-botao-entrar.png){width=75%}


## 3. ADMINISTRADOR GERAL

### 3.1. Visão geral do painel

Ao entrar, o painel do Admin apresenta uma visão consolidada das inscrições recebidas. A tabela principal exibe todos os protocolos registrados, com colunas para data, status, CPF parcial, nome, e-mail e nota final (quando disponível).

Figura 04 — Dashboard do Admin: tabela com a coluna "Protocolo"

![](../../prints/manual/fig-04-admin-dashboard-tabela-protocolo.png){width=75%}

Na parte superior da tela, você encontra os filtros de pesquisa e, ao lado, os atalhos das funções principais: **Área da Comissão**, **Ranking/Resultados**, **Credenciais de Avaliadores**, **Exportar CSV** e **Sair**.

Figura 05 — Dashboard do Admin: atalhos principais (use setas)

![](../../prints/manual/fig-05-admin-barra-atalhos.png){width=75%}

### 3.2. Buscar e filtrar inscrições

Para localizar uma inscrição específica, use o campo de busca. Ele aceita **protocolo**, **nome**, **e-mail** e **título do projeto**, facilitando a localização rápida de candidatos ou submissões.

Figura 06 — Filtro: campo "Busca (protocolo, nome, email, título)"

![](../../prints/manual/fig-06-admin-filtro-busca.png){width=75%}

Se necessário, refine o resultado pelo **status** da inscrição (Recebida, Em Análise, Aprovado, Reprovado ou Indeferido). O filtro por status ajuda a organizar o trabalho por etapas do processo.

Figura 07 — Filtro: dropdown "Status"

![](../../prints/manual/fig-07-admin-status-dropdown.png){width=75%}

Você também pode delimitar o período de busca utilizando os campos **De** e **Até**, selecionando datas específicas para filtrar inscrições recebidas em determinado intervalo.

Figura 08 — Filtro: período "De/Até"

![](../../prints/manual/fig-08-admin-filtro-periodo.png){width=75%}

Depois de configurar os filtros desejados, clique em **Filtrar** para aplicar as restrições e atualizar a tabela.

Figura 09 — Filtro: botão "Filtrar"

![](../../prints/manual/fig-09-admin-botao-filtrar.png){width=75%}

### 3.3. Abrir e conferir detalhes de uma inscrição

Para abrir os detalhes de uma inscrição, clique no **protocolo** diretamente na tabela.

Figura 10 — Tabela: protocolo clicável (abrir detalhes)

![](../../prints/manual/fig-10-admin-tabela-protocolo-link.png){width=75%}

Na tela de detalhes, você consegue revisar os dados do candidato e do projeto. Quando precisar validar a integridade das informações (por exemplo, para auditoria), utilize o link de **verificação (JSON)**.

Figura 11 — Detalhes: link "Verificação (JSON)"

![](../../prints/manual/fig-11-admin-detalhe-verificacao-json.png){width=75%}

### 3.4. Exportar CSV

A exportação em CSV é útil para relatórios e conferências. Se você quiser exportar apenas um recorte (por status ou período), aplique os filtros primeiro.

Figura 12 — Filtros preenchidos (exemplo)

![](../../prints/manual/fig-12-admin-filtros-preenchidos.png){width=75%}

Em seguida, clique em **Exportar CSV** para iniciar o download do arquivo com os dados filtrados.

Figura 13 — Botão "Exportar CSV"

![](../../prints/manual/fig-13-admin-botao-exportar-csv.png){width=75%}

O arquivo baixado pode ser aberto no Excel ou LibreOffice e contém as colunas principais de cada inscrição (protocolo, data, status, nome, e-mail, título, notas e outras informações relevantes).

Figura 14 — CSV no Excel/LibreOffice: colunas principais (sem coluna de hash)

![](../../prints/manual/fig-14-admin-csv-excel-colunas.png){width=75%}

### 3.5. Credenciais de avaliadores

Use esta área para criar e ajustar os acessos dos avaliadores. Ao clicar em **Credenciais Avaliadores**, você será direcionado para a tela de gerenciamento.

Figura 15 — Admin: botão "Credenciais Avaliadores"

![](../../prints/manual/fig-15-admin-botao-credenciais-avaliadores.png){width=75%}

O sistema exibe uma tabela com os perfis cadastrados. Cada linha representa um avaliador, mostrando informações como nome, login e status.

Figura 16 — Credenciais: linha de um avaliador na tabela

![](../../prints/manual/fig-16-admin-tabela-credenciais-linha.png){width=75%}

Selecione o avaliador desejado e atualize as informações necessárias (por exemplo, senha). Finalize clicando em salvar (quando a opção estiver disponível).

Figura 17 — Credenciais: editar senha/login e salvar

![](../../prints/manual/fig-17-admin-campo-senha-botao-salvar.png){width=75%}

### 3.6. Sair do sistema

Ao finalizar o trabalho, clique em **Sair** para encerrar sua sessão com segurança.

Figura 18 — Admin: botão "Sair" (logout)

![](../../prints/manual/fig-18-admin-botao-sair.png){width=75%}

Após o logout, confirme que a tela de login foi exibida novamente.



----

## 4. PRESIDENTE DA BANCA

O Presidente da Banca normalmente utiliza o mesmo acesso da área restrita, mas com tarefas concentradas em **Comissão** (consolidação) e **Resultados** (ranking e exportações).

### 4.1. Área da Comissão (consolidação)

Para acessar a comissão, use o atalho **Área da Comissão** no painel.

Figura 19 — Admin: botão "Área da Comissão"

![](../../prints/manual/fig-19-admin-botao-area-comissao.png){width=75%}

Na listagem da comissão, localize o protocolo desejado. A tabela mostra todos os projetos que precisam de consolidação.

Figura 20 — Comissão: lista de projetos com ação "Avaliar"

![](../../prints/manual/fig-20-comissao-lista-botao-avaliar.png){width=75%}

Clique em **Avaliar** na linha correspondente ao protocolo que deseja consolidar para abrir a tela de notas.


### 4.2. Preencher notas e salvar

A tela da comissão permite consolidar notas de **Avaliador 1**, **Avaliador 2** e **Comissão**. O preenchimento é feito por bloco (Projeto, Entrevista e Prova de Língua). Conforme as notas são informadas, o sistema exibe os campos calculados (médias e nota final).

No bloco de **Projeto**, preencha as notas para cada avaliador conforme os critérios exibidos.

Figura 21 — Comissão: seção "Projeto (3 Avaliadores)" (3 colunas)

![](../../prints/manual/fig-21-comissao-projeto-tres-colunas.png){width=75%}

No bloco de **Entrevista**, registre as notas correspondentes, também distribuídas pelos avaliadores.

Figura 22 — Comissão: seção "Entrevista (3 Avaliadores)" (3 colunas)

![](../../prints/manual/fig-22-comissao-entrevista-tres-colunas.png){width=75%}

Em **Prova de Língua**, preencha os campos principais conforme o formulário.

Figura 23 — Comissão: seção "Prova de Língua" (campos principais)

![](../../prints/manual/fig-23-comissao-lingua-campos.png){width=75%}

Depois, confira os campos calculados (Projeto, Entrevista, Língua e nota final).

Figura 24 — Comissão: notas calculadas (Projeto/Entrevista/Língua/Final)

![](../../prints/manual/fig-24-comissao-campos-notas-calculadas.png){width=75%}

Se necessário, marque **Eliminação** e registre **Observações** para justificar a decisão.

Figura 25 — Comissão: "Eliminação" e "Observações"

![](../../prints/manual/fig-25-comissao-eliminacao-observacoes.png){width=75%}

Por fim, clique em **Salvar avaliação** para registrar a consolidação.

Figura 26 — Comissão: botão "Salvar avaliação"

![](../../prints/manual/fig-26-comissao-botao-salvar-avaliacao.png){width=75%}

### 4.3. Ranking / Resultados

Para consultar o ranking e preparar os relatórios finais, clique em **Ranking / Resultados** no painel.

Figura 27 — Botão "Ranking / Resultados"

![](../../prints/manual/fig-27-resultados-botao-ranking.png){width=75%}

O sistema exibe as listagens por linha de pesquisa, facilitando a conferência e a divulgação dos resultados.

Figura 28 — Resultados: tabelas por "Linha 1" e "Linha 2"

![](../../prints/manual/fig-28-resultados-linhas-tabela.png){width=75%}

Se necessário, exporte os resultados em CSV.

Figura 29 — Resultados: botão "Baixar CSV"

![](../../prints/manual/fig-29-resultados-botao-baixar-csv.png){width=75%}

Para impressão ou geração de PDF, utilize a opção **Imprimir / PDF**.

Figura 30 — Resultados: botão "Imprimir / PDF"

![](../../prints/manual/fig-30-resultados-botao-imprimir-pdf.png){width=75%}


## 5. BOAS PRÁTICAS E SEGURANÇA

A área restrita lida com dados pessoais e informações sensíveis do processo. Por isso, não compartilhe usuário/senha, finalize sempre clicando em **Sair** e evite exportar ou repassar planilhas fora do estritamente necessário para o trabalho da banca e da coordenação.



## 6. SUPORTE

Em caso de erro, informe o perfil (Admin/Presidente), descreva o que tentou fazer e envie um print do problema (se possível). Isso acelera o diagnóstico e evita retrabalho.
