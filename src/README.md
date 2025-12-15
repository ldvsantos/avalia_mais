# Formulário de Inscrição - Planterr

Este projeto é um formulário web para submissão de projetos, inspirado na plataforma Carlos Chagas, com funcionalidade de geração de PDF.

## Estrutura

*   `index.html`: Estrutura do formulário.
*   `style.css`: Estilização visual (tema azul/cinza).
*   `script.js`: Lógica para contagem de caracteres e geração do PDF.

## Como usar

### Modo recomendado (com servidor)

1.  Instale e rode o servidor em `../server` (veja `server/README.md`).
2.  Abra o formulário em `http://localhost:3000/`.
3.  Preencha os campos do formulário.
4.  Ao finalizar, clique em "Gerar PDF do Projeto".
5.  O sistema irá:
    *   Validar CPF e exigir a declaração obrigatória.
    *   Registrar a inscrição no servidor (bloqueando duplicidade por CPF).
    *   Retornar um **Protocolo** e um **Hash (SHA-256)** verificável.
    *   Imprimir/gerar o PDF com protocolo + hash.

### Modo estático (limitado)

Abrir `index.html` diretamente (ou via `python -m http.server`) não registra inscrição e não gera protocolo/hash do servidor.

## Funcionalidades

*   **Contagem de Caracteres**: Limita e exibe a quantidade de caracteres restantes em campos de texto.
*   **Geração de PDF**: Impressão via HTML injetado em `iframe`.
*   **Protocolo + Hash verificável**: gerados no servidor e impressos no PDF.
*   **Admin**: listagem e consulta das inscrições registradas.
*   **Validação de CPF**: máscara + validação por dígitos verificadores.
*   **Blind review**: alerta/bloqueio se detectar CPF/e-mail/telefone nos campos do projeto.

## Hospedagem

Como este é um site estático (apenas HTML, CSS e JS), ele pode ser hospedado facilmente em serviços como:
*   GitHub Pages
*   Vercel
*   Netlify
*   Qualquer servidor web padrão (Apache, Nginx, etc.)
