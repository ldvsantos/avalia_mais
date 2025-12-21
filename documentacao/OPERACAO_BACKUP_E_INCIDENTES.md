# Operação: Backup/Export e Incidentes (PLANTERR)

Este documento descreve uma rotina simples para:
- **Backup** dos dados e evidências (JSON + logs + resultados publicados)
- **Exportação** de dados via painel admin
- **Resposta a incidentes** (o que fazer se houver suspeita de acesso indevido)

## 1) O que precisa ser preservado

### Dados do processo (fonte primária)
- `server/data/*.json`
  - inscrições, avaliações, recursos, calendário, status por etapa

### Evidências e auditoria
- `server/logs/security.log` (e demais logs em `server/logs/`)

### Publicações
- Arquivos públicos de resultados/comunicados (quando aplicável)
  - normalmente em `src/results/` (e listados em `server/data/public_files.json`)

## 2) Rotina de backup (recomendado)

### Frequência
- Durante inscrições/recursos: **diário** (ou a cada mudança relevante)
- Fora de período: **semanal**

### Windows (PowerShell)
No servidor/ambiente onde o projeto está:

- Executar:
  - `powershell -ExecutionPolicy Bypass -File scripts/backup-planterr.ps1`

O script cria:
- pasta `backups/planterr-backup-YYYYMMDD-HHMMSS/`
- e um ZIP ao lado (por padrão)

Observação:
- Por segurança, o script **não** copia `.env` nem chaves.

### Validação rápida do backup
- Confirme que existem arquivos em:
  - `backups/.../server-data/`
  - `backups/.../server-logs/`

## 3) Exportação (admin)

Para relatórios em planilha (Excel/LibreOffice), use o export do painel admin:
- Acessar o admin (URL camuflada por UUID)
- Na listagem, usar **Exportar CSV**

O sistema registra a ação em log (evento de exportação) para auditoria.

## 4) Procedimento de incidente (suspeita de acesso indevido)

### Objetivo
- Conter rapidamente
- Preservar evidências
- Restaurar operação com credenciais rotacionadas

### Passos (prioridade)
1. **Fazer backup imediato**
   - `powershell -ExecutionPolicy Bypass -File scripts/backup-planterr.ps1`
2. **Coletar evidências**
   - Guardar `server/logs/security.log` e horários do incidente
3. **Rotacionar credenciais de acesso admin**
   - Trocar `ADMIN_PASS` (e, se necessário, `ADMIN_USER`) no `.env` de produção
   - Reiniciar o serviço
4. **Trocar a URL camuflada do admin (UUID)**
   - Remover/renomear `server/.admin-secret` e reiniciar (um novo UUID será gerado)
5. **Revisar origem do acesso**
   - Verificar eventos de login e ações administrativas no log
   - Se houver IPs confiáveis, considerar restringir acesso via `ADMIN_IPS`

### Se suspeitar de vazamento de dados
- Siga o fluxo institucional (LGPD/CGTI/Comissão) conforme a política da organização.

## 5) Boas práticas operacionais
- Nunca armazenar senhas em arquivos versionados (use `.env` e gerenciadores de segredo).
- Preferir HTTPS em produção (cookies de sessão podem exigir `Secure`).
- Manter o servidor atualizado e com acesso administrativo restrito.
