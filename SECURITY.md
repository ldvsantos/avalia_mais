# Segurança & Autoria

Este documento define práticas para reduzir risco de adulteração, sequestro de autoria e distribuição não autorizada.

## Objetivos
- Provar autoria e integridade do código distribuído (releases).
- Detectar adulterações em artefatos e histórico.
- Reduzir risco de publicação por terceiros “em seu nome”.

## Práticas recomendadas (mínimo)
- Assinar tags de release e/ou commits (GPG ou SSH).
- Publicar a chave pública do mantenedor (ver SIGNING.md).
- Publicar checksums (SHA-256) dos artefatos distribuídos.
- Usar CI para gerar artefatos e anexar evidências (logs) de build.

## Reporte de vulnerabilidades
Envie para: <PREENCHER_EMAIL_SEGURANCA>

## Titularidade
Direitos reservados ao PLANTERR/UEFS.

## Limitações
- Nenhum mecanismo impede alguém de copiar código se ele tiver acesso. As medidas aqui ajudam a **provar autenticidade** e **detectar adulteração**, e complementam o licenciamento.
