# Como verificar autoria e integridade

Este guia descreve um procedimento **prático** para verificar se um commit/tag/release é autêntico.

## Pré-requisitos
- `git` instalado.
- (Opcional) `gpg` instalado, se você usar assinaturas GPG.

## 1) Importar chave pública do mantenedor
### Se usar GPG
1. Abra `authorship/maintainer-public-key.asc` e confirme com o mantenedor que o fingerprint está correto.
2. Importe:
   - `gpg --import authorship/maintainer-public-key.asc`

### Se usar assinatura SSH
- A chave pública (para verificação) deve estar documentada em `authorship/MAINTAINERS.md`.

## 2) Verificar assinatura do commit
- `git log --show-signature -1`

O Git deve mostrar que a assinatura é **Good** e associada a um mantenedor autorizado.

## 3) Verificar assinatura da tag (releases)
- `git verify-tag vX.Y.Z`

## 4) Verificar checksums de artefatos
Quando houver um arquivo `checksums/SHA256SUMS.txt`:
- Calcule o SHA-256 do artefato e compare com o publicado.

> Em Windows (PowerShell): `Get-FileHash .\artefato.zip -Algorithm SHA256`
