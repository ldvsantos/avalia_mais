---
title: "Manual do Candidato — Sistema PLANTERR"
subtitle: "Inscrição, envio e geração do PDF"
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

Este manual explica, em linguagem simples, como o **candidato** realiza a inscrição no Sistema PLANTERR.

Ao final do processo, o sistema gera um **PDF oficial** com:

- **Protocolo** (número de inscrição)
- **Hash (SHA-256)** (código de verificação)

---

## 2. Antes de começar

### 2.1. O que você precisa

- Um computador ou celular com internet
- Um navegador atualizado (Chrome, Edge ou Firefox)
- Tempo para preencher o formulário com calma

### 2.2. Importante: avaliação às cegas

O anteprojeto é avaliado **sem identificação**. Por isso:

- Não escreva **CPF**, **e-mail**, **telefone** ou qualquer dado pessoal no texto do projeto.
- Se o sistema detectar dado pessoal, ele vai impedir o envio.

---

## 3. Como acessar o formulário

1. Abra o navegador.
2. Acesse o link do formulário enviado pela coordenação.

![Figura 03 — Página inicial do formulário: título e primeira seção.](prints/manual/fig-03-formulario-inicio-titulo.png)

---

## 4. Preenchendo a inscrição

### 4.1. Ficha de Inscrição

1. Preencha os campos principais (nome, CPF, e-mail, etc.).
2. Confira se não há mensagem de erro no CPF.

![Figura 05 — “Ficha de Inscrição”: campos de Nome e CPF.](prints/manual/fig-05-ficha-campos-nome-cpf.png)

**Se aparecer “CPF inválido”**

- Confira se digitou 11 números.
- Evite copiar/colar; se necessário, apague e digite novamente.

![Figura 06 — Exemplo de validação: mensagem “CPF inválido”.](prints/manual/fig-06-cpf-invalido-mensagem.png)

### 4.2. Termo de Compromisso (obrigatório)

No final da ficha existe um termo/declaração.

1. Leia o texto.
2. Marque a caixa de concordância.

Se não marcar, o sistema impede a geração do PDF.

![Figura 07 — “Termo de Compromisso”: caixa de seleção e aviso de obrigatoriedade.](prints/manual/fig-07-termo-compromisso-checkbox.png)

---

## 5. Preenchendo o Projeto de Pesquisa

### 5.1. Selecionar a área (linha de pesquisa)

1. Na seção “Projeto de Pesquisa”, selecione a **Área/Linha de Pesquisa**.
2. Se você não selecionar, o sistema pede para corrigir.

![Figura 08 — “Projeto de Pesquisa”: seleção de “Área”.](prints/manual/fig-08-projeto-area-select.png)

### 5.2. Resumo e limite de caracteres

Alguns campos têm limite de caracteres.

- O contador mostra quanto ainda pode ser digitado.

![Figura 09 — Campo “Resumo”: contador de caracteres restantes.](prints/manual/fig-09-resumo-contador-caracteres.png)

### 5.3. Evitar dados pessoais (regra da avaliação às cegas)

**Não faça:** inserir telefone/e-mail/CPF no texto do projeto.

![Figura 10 — Exemplo (NÃO fazer): dado pessoal dentro do texto do projeto.](prints/manual/fig-10-blind-review-exemplo-dados-pessoais.png)

Se o sistema detectar, aparece um alerta e você precisa remover.

![Figura 11 — Alerta de “avaliação às cegas”: possível dado pessoal detectado.](prints/manual/fig-11-blind-review-alerta-dados-pessoais.png)

---

## 6. Revisar antes de enviar (Rascunho)

O sistema permite baixar um **rascunho** para revisão.

1. Clique em **Baixar Rascunho (Não Envia)**.

![Figura 12 — Botão “Baixar Rascunho (Não Envia)”.](prints/manual/fig-14-botao-enviar-gerar-pdf.png)

2. Abra o PDF e revise o conteúdo.

![Figura 13 — Rascunho em PDF (Não Envia)”.](prints/manual/fig-13-rascunho-pdf-nao-envia.jpg)



**Atenção:** rascunho não registra inscrição e não tem protocolo/hash do servidor.

---

## 7. Enviar inscrição e gerar o PDF oficial

1. Clique em **Enviar Inscrição e Gerar PDF**.

![Figura 14 — Botão “Enviar Inscrição e Gerar PDF”.](prints/manual/fig-14-botao-enviar-gerar-pdf.png)

2. Na confirmação, clique em **Confirmar Envio**.

![Figura 15 — Modal de confirmação: “Confirmar Envio” e “Voltar e Revisar”.](prints/manual/fig-15-modal-confirmacao-envio.png)

3. Aguarde o processamento (pode aparecer “Registrando...” e depois “Gerando...”).

4. Ao final, baixe e abra o PDF.
5. Confirme se o PDF tem **Protocolo** e **Hash (SHA-256)**.

![Figura 17 — PDF oficial gerado: Protocolo e Hash (SHA-256).](prints/manual/fig-17-pdf-protocolo-hash.png)

---

## 8. Guardar e verificar a inscrição

### 8.1. O que guardar

Guarde:

- O PDF oficial gerado
- O número do Protocolo

### 8.2. Verificação (quando solicitado)

Se a coordenação pedir, é possível verificar a inscrição pelo protocolo.

1. Encontre o protocolo no PDF.

![Figura 18 — PDF: Protocolo destacado.](prints/manual/fig-18-pdf-protocolo-destaque.jpg)

1. Abra o navegador e acesse a URL de verificação no mesmo domínio do sistema:

`/api/verify/SEU_PROTOCOLO`

![Figura 19 — Navegador: URL “/api/verify/{protocolo}”.](prints/manual/fig-19-url-verify-protocolo.png)

3. Verifique se aparece `valid: true`.

![Figura 20 — Verificação JSON: `valid: true`.](prints/manual/fig-20-json-verify-valid-true.png)

---

## 9. Dúvidas frequentes

**Não consigo gerar o PDF. O que faço?**

- Verifique se o CPF é válido.
- Marque o termo de compromisso.
- Se houver alerta de avaliação às cegas, remova dados pessoais do texto.

**Posso enviar duas inscrições com o mesmo CPF?**

- Não. O sistema bloqueia duplicidade.

---

## 10. Suporte

Em caso de erro que impeça o envio:

- Informe à coordenação seu nome completo e o que aconteceu.
- Se possível, envie uma captura de tela do erro.
