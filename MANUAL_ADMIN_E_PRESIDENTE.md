---
title: "Manual da Área Restrita — Sistema PLANTERR"
subtitle: "Administrador Geral e Presidente da Banca"
author: "Equipe de Desenvolvimento"
date: "15/12/2025"
lang: "pt-BR"
toc: true
toc-depth: 3
number-sections: true
geometry: "margin=2.5cm"
---

**Versão:** 1.0  
**Atualizado em:** 15/12/2025

---

## 1. Apresentação

Este manual é destinado a usuários da **área restrita** do Sistema PLANTERR, com foco em:

- **Administrador Geral** (gestão de inscrições, relatórios e credenciais)
- **Presidente da Banca** (comissão, consolidação e resultados)

---

## 2. Acesso à área restrita

1. Acesse o link da área restrita fornecido pela coordenação.
2. Informe usuário e senha.
3. Clique em **Entrar**.

![Figura 21 — Tela de login do Admin: URL/campo “Usuário”.](prints/manual/fig-21-login-admin-tela.png)

![Figura 22 — Login do Admin: campos “Usuário” e “Senha”.](prints/manual/fig-22-login-admin-campos.png)

![Figura 23 — Login do Admin: botão “Entrar”.](prints/manual/fig-23-login-admin-botao-entrar.png)

---

## 3. Administrador Geral

### 3.1. Visão geral do painel

Ao entrar, o painel do Admin apresenta:

- Tabela de inscrições
- Filtros de pesquisa
- Ações (CSV, credenciais, comissão, resultados, sair)

![Figura 24 — Dashboard do Admin: tabela com a coluna “Protocolo”.](prints/manual/fig-24-admin-dashboard-tabela-protocolo.png)

![Figura 25 — Dashboard do Admin: atalhos principais (use setas).](prints/manual/fig-25-admin-barra-atalhos.png)

### 3.2. Buscar e filtrar inscrições

1. Digite no campo de busca (protocolo, nome, e-mail ou título).
2. Selecione o status (se aplicável).
3. Ajuste o período “De/Até” (se aplicável).
4. Clique em **Filtrar**.

![Figura 26 — Filtro: campo “Busca (protocolo, nome, email, título)”.](prints/manual/fig-26-admin-busca-campo.png)

![Figura 27 — Filtro: dropdown “Status”.](prints/manual/fig-27-admin-status-dropdown.png)

![Figura 28 — Filtro: período “De/Até”.](prints/manual/fig-28-admin-data-de-ate.png)

![Figura 29 — Filtro: botão “Filtrar”.](prints/manual/fig-29-admin-botao-filtrar.png)

### 3.3. Abrir e conferir detalhes de uma inscrição

1. Na tabela, clique no **protocolo**.

![Figura 30 — Tabela: protocolo clicável (abrir detalhes).](prints/manual/fig-30-admin-tabela-protocolo-link.png)

2. Na tela de detalhes, verifique:

- dados da inscrição (candidato e projeto)
- protocolo e hash
- link de **verificação (JSON)**

![Figura 31 — Detalhes: link “Verificação (JSON)”.](prints/manual/fig-31-admin-detalhe-link-verificacao-json.png)

### 3.4. Exportar CSV

1. Aplique filtros (se desejar exportar apenas um recorte).
2. Clique em **Baixar CSV**.
3. Abra o arquivo no Excel/LibreOffice.

![Figura 32 — Filtros preenchidos (exemplo).](prints/manual/fig-32-admin-filtros-preenchidos.png)

![Figura 33 — Botão “Baixar CSV”.](prints/manual/fig-33-admin-botao-baixar-csv.png)

![Figura 34 — CSV no Excel/LibreOffice: colunas principais.](prints/manual/fig-34-admin-csv-excel-colunas.png)

### 3.5. Credenciais de avaliadores

Use esta área para criar/ajustar acessos dos avaliadores.

1. Clique em **Credenciais Avaliadores**.
2. Localize o avaliador.
3. Ajuste login/senha.
4. Clique em salvar (quando disponível).

![Figura 35 — Admin: botão “Credenciais Avaliadores”.](prints/manual/fig-35-admin-botao-credenciais-avaliadores.png)

![Figura 36 — Credenciais: linha de um avaliador na tabela.](prints/manual/fig-36-admin-tabela-credenciais-linha.png)

![Figura 37 — Credenciais: editar senha/login e salvar.](prints/manual/fig-37-admin-campo-senha-botao-salvar.png)

### 3.6. Sair do sistema

1. Clique em **Sair**.

![Figura 38 — Admin: botão “Sair” (logout).](prints/manual/fig-38-admin-botao-sair.png)

2. Confirme que retornou ao login.

![Figura 39 — Login após sair: campo “Usuário”.](prints/manual/fig-39-admin-tela-login-apos-sair.png)

---

## 4. Presidente da Banca

> Normalmente utiliza o acesso de Admin, mas com tarefas focadas em **Comissão** e **Resultados**.

### 4.1. Área da Comissão (consolidação)

1. No painel, clique em **Área da Comissão**.

![Figura 40 — Admin: botão “Área da Comissão”.](prints/manual/fig-40-admin-botao-area-comissao.png)

2. Localize um protocolo e clique em **Avaliar**.

![Figura 41 — Comissão: lista de projetos com ação “Avaliar”.](prints/manual/fig-41-comissao-lista-botao-avaliar.png)

![Figura 42 — Comissão: botão “Avaliar” em um protocolo.](prints/manual/fig-42-comissao-lista-avaliar-circule.png)

### 4.2. Preencher notas e salvar

A tela da comissão permite consolidar notas de **Avaliador 1**, **Avaliador 2** e **Comissão**.

1. Preencha as notas do critério **Projeto**.

![Figura 43 — Comissão: seção “Projeto (3 Avaliadores)” (3 colunas).](prints/manual/fig-43-comissao-projeto-tres-colunas.png)

2. Preencha as notas do critério **Entrevista**.

![Figura 44 — Comissão: seção “Entrevista (3 Avaliadores)” (3 colunas).](prints/manual/fig-44-comissao-entrevista-tres-colunas.png)

3. Preencha as notas da **Prova de Língua**.

![Figura 45 — Comissão: seção “Prova de Língua” (campos principais).](prints/manual/fig-45-comissao-lingua-campos.png)

4. Confira os campos calculados (médias e nota final).

![Figura 46 — Comissão: notas calculadas (Projeto/Entrevista/Língua/Final).](prints/manual/fig-46-comissao-campos-notas-calculadas.png)

5. (Opcional) Marque **Eliminação** e registre **Observações**.

![Figura 47 — Comissão: “Eliminação” e “Observações”.](prints/manual/fig-47-comissao-eliminacao-observacoes.png)

6. Clique em **Salvar avaliação**.

![Figura 48 — Comissão: botão “Salvar avaliação”.](prints/manual/fig-48-comissao-botao-salvar-avaliacao.png)

### 4.3. Ranking / Resultados

1. No painel, clique em **Ranking / Resultados**.

![Figura 49 — Botão “Ranking / Resultados”.](prints/manual/fig-49-resultados-botao-ranking.png)

2. Confira a listagem por linha de pesquisa.

![Figura 50 — Resultados: tabelas por “Linha 1” e “Linha 2”.](prints/manual/fig-50-resultados-linhas-tabela.png)

3. Exportar em CSV.

![Figura 51 — Resultados: botão “Baixar CSV”.](prints/manual/fig-51-resultados-botao-baixar-csv.png)

4. Imprimir/gerar PDF.

![Figura 52 — Resultados: botão “Imprimir / PDF”.](prints/manual/fig-52-resultados-botao-imprimir-pdf.png)

---

## 5. Boas práticas e segurança

- Não compartilhe usuário/senha.
- Sempre clique em **Sair** ao finalizar.
- Evite exportar/compartilhar planilhas com dados pessoais fora do necessário.

![Figura 01 — Mensagem de boas práticas: “não compartilhar senha”.](prints/manual/fig-01-boas-praticas-nao-compartilhar-senha.png)

---

## 6. Suporte

Em caso de erro:

- Informe o perfil (Admin/Presidente)
- Descreva o que tentou fazer
- Envie print do erro (se possível)
