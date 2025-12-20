# Assinatura e verificação de autoria (Git SSH)

Este projeto usa assinaturas criptográficas para permitir que qualquer pessoa verifique:
- que um release/commit foi feito por uma chave autorizada;
- que o conteúdo não foi adulterado.

## 1) O que é publicado neste repositório
- Chave pública do mantenedor (SSH signing): `authorship/maintainer-public-key.pub`.
- Lista de mantenedores autorizados: `authorship/MAINTAINERS.md`.
- Arquivo de verificadores autorizados (template): `authorship/allowed_signers.example`.

## 2) Assinatura SSH (recomendada)

### Assinar commits
1. Configure o Git para usar assinatura SSH:
   - `git config --global gpg.format ssh`
   - `git config --global user.signingkey <CAMINHO_OU_ID_DA_SUA_CHAVE_SSH>`
   - `git config --global commit.gpgsign true`

2. Verificar assinatura:
   - `git log --show-signature -1`

### Verificar assinaturas (allowed signers)
Para que a verificação funcione de forma confiável em outras máquinas/CI, configure:
- `git config --global gpg.ssh.allowedSignersFile <CAMINHO_PARA_ALLOWED_SIGNERS>`

Use como base `authorship/allowed_signers.example`.

## 4) Checksums de artefatos
Quando publicar um binário/zip, gere e publique SHA-256.
- Exemplo (PowerShell):
  - `Get-FileHash .\artefato.zip -Algorithm SHA256`

## 5) Observação importante
Eu não consigo gerar sua chave privada com segurança aqui. Gere a chave localmente e publique **apenas a chave pública** neste repositório.
