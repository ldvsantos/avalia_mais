---
title: "Manual do Usuário — Sistema PLANTERR"
subtitle: "Inscrições, Avaliação e Resultados"
author: "Equipe de Desenvolvimento"
date: "15/12/2025"
lang: "pt-BR"
toc: true
toc-depth: 3
number-sections: true
geometry: "margin=2.5cm"
---

**Versão:** 1.0  
**Data:** 15/12/2025  
**Perfis atendidos neste manual:** Candidato, Administrador Geral, Presidente da Banca, Avaliador

---

## Para quem é este manual

Este manual foi escrito para orientar **pessoas sem familiaridade técnica** a usar o Sistema PLANTERR.

- Se você vai **se inscrever**, leia a **PARTE 1 — Candidato**.
- Se você faz parte da **equipe (Admin/Presidente/Avaliador)**, leia a **PARTE 2 — Área restrita**.
- Se apareceu alguma dúvida ou erro, consulte a **PARTE 3 — Dúvidas e suporte**.

## 1. Visão geral do sistema

O **Sistema PLANTERR** apoia o processo de seleção de anteprojetos, com:

- **Candidato**: preenche o formulário, envia a inscrição e gera um PDF com **Protocolo** e **Hash**.
- **Administrador Geral**: acompanha inscrições, consulta detalhes, exporta CSV, gerencia credenciais e executa ações administrativas.
- **Presidente da Banca**: consolida avaliações (inclusive a “Comissão”), acompanha ranking/resultados e emite relatórios.
- **Avaliador**: acessa sua área, lista projetos atribuídos e registra notas.

---

## 2. Como usar este manual (imagens e destaque visual)

Este manual usa figuras para ilustrar as telas. As figuras são **apenas exemplos** (a tela pode variar um pouco conforme o navegador ou atualizações do sistema).

### 2.1. Padrão obrigatório das imagens

Para todas as capturas de tela inseridas:

- Inclua **setas**, **caixas de destaque** ou **círculos** para guiar o olhar do usuário.
- Destaque botões e campos relevantes (ex.: “Enviar Inscrição e Gerar PDF”, “Filtrar”, “Salvar avaliação”, etc.).
- Se a tela tiver muitos elementos, faça **zoom** (ou recorte) no componente principal.

> Se você estiver lendo a versão em PDF/impresso, as figuras já aparecem no documento.

---

## 3. Acesso e perfis

### 3.1. Tipos de usuário e permissões (resumo)

- **Candidato**: não faz login; acessa a página principal do formulário.
- **Administrador Geral**: faz login na **área restrita**, usando o link fornecido pela coordenação.
- **Presidente da Banca**: normalmente usa acesso de admin, mas trabalha principalmente na **Área da Comissão** e **Resultados**.
- **Avaliador**: faz login e acessa sua área específica (linha e número).

### 3.2. Boas práticas de segurança

1. Não compartilhe usuário e senha em grupos abertos.
    ![Figura 01 — Mensagem de boas práticas: “não compartilhar senha”.](prints/manual/fig-01-boas-praticas-nao-compartilhar-senha.png)
2. Sempre clique em **Sair** ao terminar.
    ![Figura 02 — Painel Admin: botão “Sair” (logout).](prints/manual/fig-02-admin-botao-sair-topo.png)

---

## PARTE 1 — CANDIDATO (Inscrição e PDF)

## 4. Candidato: preencher e enviar a inscrição

O candidato usa a **página principal** do sistema (formulário web). Ele pode:

- Preencher manualmente;
- Usar **Preencher Exemplo** (somente para treino);
- Baixar um **Rascunho (Não Envia)**;
- Enviar a inscrição e gerar o PDF oficial em **Enviar Inscrição e Gerar PDF**.

### 4.1. Abrir o formulário

1. Abra o navegador e acesse o link informado pela coordenação.
    ![Figura 03 — Página inicial do formulário: título e primeira seção.](prints/manual/fig-03-formulario-inicio-titulo.png)
2. Verifique se o formulário está carregado (campos de “Ficha de Inscrição” e “Projeto de Pesquisa”).
    ![Figura 04 — Formulário: seções “Ficha de Inscrição” e “Projeto de Pesquisa”.](prints/manual/fig-04-formulario-secoes-ficha-projeto.png)

### 4.2. Preencher a Ficha de Inscrição

1. Preencha os campos obrigatórios (ex.: Nome, CPF, Título do Projeto).
    ![Figura 05 — “Ficha de Inscrição”: campos de Nome e CPF.](prints/manual/fig-05-ficha-campos-nome-cpf.png)
2. Digite o CPF e verifique se o sistema não mostra mensagem de erro.
    ![Figura 06 — Exemplo de validação: mensagem “CPF inválido”.](prints/manual/fig-06-cpf-invalido-mensagem.png)
3. Marque a declaração/termo obrigatório.
    ![Figura 07 — “Termo de Compromisso”: caixa de seleção e aviso de obrigatoriedade.](prints/manual/fig-07-termo-compromisso-checkbox.png)

### 4.3. Preencher o Projeto de Pesquisa

1. Preencha o título e selecione a **Linha de Pesquisa** em “Área”.
    ![Figura 08 — “Projeto de Pesquisa”: seleção de “Área”.](prints/manual/fig-08-projeto-area-select.png)
2. Preencha o “Resumo” e observe o contador de caracteres.
    ![Figura 09 — Campo “Resumo”: contador de caracteres restantes.](prints/manual/fig-09-resumo-contador-caracteres.png)

### 4.4. Atenção: avaliação às cegas (não inserir dados pessoais no projeto)

O sistema bloqueia o envio se detectar **CPF, e-mail ou telefone** dentro dos campos do projeto.

1. Revise se você não colocou dados pessoais no título, resumo ou outros campos do projeto.
    ![Figura 10 — Exemplo (NÃO fazer): dado pessoal dentro do texto do projeto.](prints/manual/fig-10-blind-review-exemplo-dados-pessoais.png)
2. Se aparecer um alerta sobre dados pessoais, remova o conteúdo indicado e tente novamente.
    ![Figura 11 — Alerta de “avaliação às cegas”: possível dado pessoal detectado.](prints/manual/fig-11-blind-review-alerta-dados-pessoais.png)

### 4.5. Usar “Baixar Rascunho (Não Envia)” (somente revisão)

Use esta opção para revisar o conteúdo antes do envio oficial.

1. Clique em **Baixar Rascunho (Não Envia)**.
    ![Figura 12 — Botão “Baixar Rascunho (Não Envia)”.](prints/manual/fig-12-botao-baixar-rascunho.png)
2. Confirme se o arquivo foi baixado e abra o PDF para revisar.
    ![Figura 13 — Pasta de downloads: arquivo do rascunho (PDF).](prints/manual/fig-13-downloads-pdf-rascunho.png)

> Observação: o rascunho não gera protocolo/hash do servidor (não tem validade de envio).

### 4.6. Enviar inscrição e gerar PDF oficial

1. Clique em **Enviar Inscrição e Gerar PDF**.
    ![Figura 14 — Botão “Enviar Inscrição e Gerar PDF”.](prints/manual/fig-14-botao-enviar-gerar-pdf.png)
2. No modal de confirmação, clique em **Confirmar Envio**.
    ![Figura 15 — Modal de confirmação: “Confirmar Envio” e “Voltar e Revisar”.](prints/manual/fig-15-modal-confirmacao-envio.png)
3. Aguarde o sistema registrar a inscrição (o botão pode indicar “Registrando...” e depois “Gerando...”).
    ![Figura 16 — Estado do envio: botão “Registrando...” / “Gerando...”.](prints/manual/fig-16-botao-estado-registrando-gerando.png)
4. Baixe/abra o PDF gerado e confirme a presença de **Protocolo** e **Hash (SHA-256)**.
    ![Figura 17 — PDF oficial gerado: Protocolo e Hash (SHA-256).](prints/manual/fig-17-pdf-protocolo-hash.png)

### 4.7. Como verificar a autenticidade (protocolo/hash)

Em geral, basta **guardar o seu PDF** com Protocolo e Hash. Caso a coordenação solicite uma verificação, siga as orientações abaixo.

1. Localize o **Protocolo** no seu PDF.
    ![Figura 18 — PDF: Protocolo destacado.](prints/manual/fig-18-pdf-protocolo-destaque.png)
2. No navegador, acesse: `/api/verify/SEU_PROTOCOLO` (no mesmo domínio do sistema).
    ![Figura 19 — Navegador: URL “/api/verify/{protocolo}”.](prints/manual/fig-19-url-verify-protocolo.png)
3. Verifique se o campo `valid` está como `true`.
    ![Figura 20 — Verificação JSON: `valid: true`.](prints/manual/fig-20-json-verify-valid-true.png)

---

## PARTE 2 — ÁREA RESTRITA (EQUIPE)

Esta parte é para quem trabalha na equipe do processo seletivo: **Administrador Geral**, **Presidente da Banca** e **Avaliadores**.

> Se você não recebeu usuário/senha e link de acesso, solicite à coordenação.

## 5. Administrador Geral: login e painel de inscrições

### 5.1. Fazer login (Admin)

1. Acesse a URL de login administrativa fornecida pela coordenação.
    ![Figura 21 — Tela de login do Admin: URL/campo “Usuário”.](prints/manual/fig-21-login-admin-tela.png)
2. Digite usuário e senha do Admin.
    ![Figura 22 — Login do Admin: campos “Usuário” e “Senha”.](prints/manual/fig-22-login-admin-campos.png)
3. Clique em **Entrar**.
    ![Figura 23 — Login do Admin: botão “Entrar”.](prints/manual/fig-23-login-admin-botao-entrar.png)

### 5.2. Entender o Dashboard do Admin

1. Confira a tabela de inscrições (colunas: data, protocolo, status, etc.).
    ![Figura 24 — Dashboard do Admin: tabela com a coluna “Protocolo”.](prints/manual/fig-24-admin-dashboard-tabela-protocolo.png)
2. Identifique os atalhos principais (Área da Comissão, Ranking/Resultados, Credenciais Avaliadores, Sair).
    ![Figura 25 — Dashboard do Admin: atalhos principais (use setas).](prints/manual/fig-25-admin-barra-atalhos.png)

### 5.3. Buscar e filtrar inscrições

1. No campo de busca, digite protocolo, nome, e-mail ou título.
    ![Figura 26 — Filtro: campo “Busca (protocolo, nome, email, título)”.](prints/manual/fig-26-admin-busca-campo.png)
2. Selecione um status (ou “Todos”).
    ![Figura 27 — Filtro: dropdown “Status”.](prints/manual/fig-27-admin-status-dropdown.png)
3. (Opcional) Defina período “De/Até”.
    ![Figura 28 — Filtro: período “De/Até”.](prints/manual/fig-28-admin-data-de-ate.png)
4. Clique em **Filtrar**.
    ![Figura 29 — Filtro: botão “Filtrar”.](prints/manual/fig-29-admin-botao-filtrar.png)

### 5.4. Abrir detalhes de uma inscrição

1. Clique no **protocolo** da inscrição na tabela.
    ![Figura 30 — Tabela: protocolo clicável (abrir detalhes).](prints/manual/fig-30-admin-tabela-protocolo-link.png)
2. Na tela de detalhes, verifique:
    - Dados do candidato (quando identificado);
    - Dados do projeto;
    - Hash/protocolo;
    - Link de verificação (JSON).
    ![Figura 31 — Detalhes: link “Verificação (JSON)”.](prints/manual/fig-31-admin-detalhe-link-verificacao-json.png)

### 5.5. Exportar CSV das inscrições

1. Aplique filtros (se necessário).
    ![Figura 32 — Filtros preenchidos (exemplo).](prints/manual/fig-32-admin-filtros-preenchidos.png)
2. Clique em **Baixar CSV**.
    ![Figura 33 — Botão “Baixar CSV”.](prints/manual/fig-33-admin-botao-baixar-csv.png)
3. Abra o CSV no Excel/LibreOffice.
    ![Figura 34 — CSV no Excel/LibreOffice: colunas principais.](prints/manual/fig-34-admin-csv-excel-colunas.png)

### 5.6. Gerenciar credenciais de avaliadores

1. Clique em **Credenciais Avaliadores**.
    ![Figura 35 — Admin: botão “Credenciais Avaliadores”.](prints/manual/fig-35-admin-botao-credenciais-avaliadores.png)
2. Localize o avaliador desejado.
    ![Figura 36 — Credenciais: linha de um avaliador na tabela.](prints/manual/fig-36-admin-tabela-credenciais-linha.png)
3. Atualize login/senha conforme necessário e salve.
    ![Figura 37 — Credenciais: editar senha/login e salvar.](prints/manual/fig-37-admin-campo-senha-botao-salvar.png)

### 5.7. Sair (logout)

1. Clique em **Sair**.
    ![Figura 38 — Admin: botão “Sair” (logout).](prints/manual/fig-38-admin-botao-sair.png)
2. Confirme que voltou para a tela de login.
    ![Figura 39 — Login após sair: campo “Usuário”.](prints/manual/fig-39-admin-tela-login-apos-sair.png)

---

## 6. Presidente da Banca: Comissão e Resultados

## 6. Presidente da Banca: Área da Comissão e consolidação

> Este perfil normalmente acessa com credenciais de Admin, mas suas tarefas são focadas em consolidar avaliações e emitir resultados.

### 6.1. Acessar “Área da Comissão”

1. No Dashboard do Admin, clique em **Área da Comissão**.
    ![Figura 40 — Admin: botão “Área da Comissão”.](prints/manual/fig-40-admin-botao-area-comissao.png)
2. Verifique a lista de projetos disponíveis para consolidação.
    ![Figura 41 — Comissão: lista de projetos com ação “Avaliar”.](prints/manual/fig-41-comissao-lista-botao-avaliar.png)

### 6.2. Consolidar notas (Projeto, Entrevista e Língua)

Nesta tela existem blocos para **Avaliador 1**, **Avaliador 2** e **Comissão**.

1. Clique em **Avaliar** no protocolo desejado.
    ![Figura 42 — Comissão: botão “Avaliar” em um protocolo.](prints/manual/fig-42-comissao-lista-avaliar-circule.png)
2. Preencha as notas do critério **Projeto** para cada avaliador.
    ![Figura 43 — Comissão: seção “Projeto (3 Avaliadores)” (3 colunas).](prints/manual/fig-43-comissao-projeto-tres-colunas.png)
3. Preencha as notas do critério **Entrevista**.
    ![Figura 44 — Comissão: seção “Entrevista (3 Avaliadores)” (3 colunas).](prints/manual/fig-44-comissao-entrevista-tres-colunas.png)
4. Preencha as notas do critério **Prova de Língua**.
    ![Figura 45 — Comissão: seção “Prova de Língua” (campos principais).](prints/manual/fig-45-comissao-lingua-campos.png)
5. Confira os campos calculados automaticamente:
    - Nota do Projeto (média)
    - Nota da Entrevista (média)
    - Nota da Língua (média)
    - Nota Final (P=4, E=5, L=1)
    ![Figura 46 — Comissão: notas calculadas (Projeto/Entrevista/Língua/Final).](prints/manual/fig-46-comissao-campos-notas-calculadas.png)
6. (Opcional) Marque **Eliminação (Casos omissos)** e preencha **Observações**.
    ![Figura 47 — Comissão: “Eliminação” e “Observações”.](prints/manual/fig-47-comissao-eliminacao-observacoes.png)
7. Clique em **Salvar avaliação**.
    ![Figura 48 — Comissão: botão “Salvar avaliação”.](prints/manual/fig-48-comissao-botao-salvar-avaliacao.png)

### 6.3. Acessar Ranking / Resultados

1. No Dashboard do Admin, clique em **Ranking / Resultados**.
    ![Figura 49 — Botão “Ranking / Resultados”.](prints/manual/fig-49-resultados-botao-ranking.png)
2. Visualize as tabelas por linha de pesquisa.
    ![Figura 50 — Resultados: tabelas por “Linha 1” e “Linha 2”.](prints/manual/fig-50-resultados-linhas-tabela.png)
3. Para exportar, clique em **Baixar CSV**.
    ![Figura 51 — Resultados: botão “Baixar CSV”.](prints/manual/fig-51-resultados-botao-baixar-csv.png)
4. Para gerar PDF/impressão, clique em **Imprimir / PDF**.
    ![Figura 52 — Resultados: botão “Imprimir / PDF”.](prints/manual/fig-52-resultados-botao-imprimir-pdf.png)

---

## 7. Avaliador: acessar área e registrar notas

O avaliador acessa uma área específica (definida por **linha** e **número do avaliador**).

### 7.1. Fazer login como avaliador

1. Acesse a tela de login (fornecida pela coordenação).
    ![Figura 53 — Login do avaliador: tela e campos.](prints/manual/fig-53-avaliador-login-tela.png)
2. Digite o usuário e senha do avaliador.
    ![Figura 54 — Login do avaliador: campos preenchidos (exemplo).](prints/manual/fig-54-avaliador-login-campos.png)
3. Clique em **Entrar**.
    ![Figura 55 — Login do avaliador: botão “Entrar”.](prints/manual/fig-55-avaliador-login-botao-entrar.png)
4. Confirme que você foi redirecionado para a lista de projetos do avaliador.
    ![Figura 56 — Área do avaliador: lista de projetos e ação “Avaliar”.](prints/manual/fig-56-avaliador-lista-projetos.png)

### 7.2. Abrir um projeto para avaliação

1. Localize o protocolo desejado.
    ![Figura 57 — Avaliador: linha do protocolo na listagem.](prints/manual/fig-57-avaliador-lista-linha-protocolo.png)
2. Clique em **Avaliar**.
    ![Figura 58 — Avaliador: botão “Avaliar” no protocolo.](prints/manual/fig-58-avaliador-botao-avaliar.png)

### 7.3. Preencher e salvar a avaliação

1. Preencha as notas do **Projeto** (subitens) referentes ao seu perfil de avaliador.
    ![Figura 59 — Formulário do avaliador: campos numéricos do Projeto.](prints/manual/fig-59-avaliador-formulario-projeto-campos.png)
2. Preencha as notas da **Entrevista**.
    ![Figura 60 — Formulário do avaliador: campos da Entrevista.](prints/manual/fig-60-avaliador-formulario-entrevista-campos.png)
3. Preencha as notas da **Língua**.
    ![Figura 61 — Formulário do avaliador: campos da Língua.](prints/manual/fig-61-avaliador-formulario-lingua-campos.png)
4. Clique em **Salvar avaliação**.
    ![Figura 62 — Formulário do avaliador: botão “Salvar avaliação”.](prints/manual/fig-62-avaliador-botao-salvar-avaliacao.png)
5. Confirme o retorno para a lista e repita para os demais protocolos.
    ![Figura 63 — Avaliador: listagem após salvar (protocolo avaliado).](prints/manual/fig-63-avaliador-lista-apos-salvar.png)

---

## PARTE 3 — DÚVIDAS E SUPORTE

## 8. Perguntas frequentes

**P (Candidato): consigo enviar mais de uma inscrição com o mesmo CPF?**  
**R:** Não. O servidor bloqueia duplicidade por CPF. Se precisar corrigir algo, entre em contato com a coordenação antes de um novo envio.

**P (Candidato): o que é Protocolo e Hash?**  
**R:** O Protocolo identifica sua inscrição. O Hash é um código verificável (SHA-256) que permite conferir integridade (se o conteúdo registrado corresponde ao que foi enviado).

**P (Admin): como exporto a lista filtrada?**  
**R:** Aplique os filtros e clique em **Baixar CSV**. O arquivo exporta apenas o que está dentro do filtro.

**P (Presidente): por que existem 3 colunas (Avaliador 1, Avaliador 2 e Comissão)?**  
**R:** A tela da Comissão consolida e calcula as médias considerando três “fontes” de avaliação. Isso padroniza o resultado final e permite relatórios.

**P (Avaliador): posso alterar uma avaliação depois de salvar?**  
**R:** Sim. Abra novamente o protocolo em **Avaliar**, ajuste as notas e salve.

## 9. Problemas comuns

### 9.1. “CPF inválido”

- Confira se digitou todos os números.
- Se estiver copiando/colando, apague e digite novamente.
- Se o erro persistir, teste em outro navegador.

### 9.2. “Obrigatório marcar a declaração para gerar o PDF”

- Volte até o final do formulário e marque o **Termo de Compromisso**.

### 9.3. “Foi detectado possível dado pessoal no projeto”

- Remova do texto do projeto qualquer **CPF, e-mail, telefone** ou identificação pessoal.
- Tente novamente após revisar o conteúdo.

### 9.4. Não consigo acessar a área restrita

- Confirme se você está usando o **link correto** (fornecido pela coordenação).
- Verifique usuário e senha.
- Se esqueceu a senha, peça ao Administrador para redefinir.

## 10. Contato e suporte

Se você encontrar erro que impede o uso do sistema, informe à coordenação:

- Seu perfil (Candidato/Admin/Presidente/Avaliador)
- O que você estava tentando fazer
- Uma captura de tela do erro (se possível)

