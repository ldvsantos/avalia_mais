# Copie este arquivo para scripts/deploy-config.ps1 e ajuste.
# NÃO commite scripts/deploy-config.ps1 (já está no .gitignore).

@{
  Host      = '13.59.123.67'
  User      = 'ubuntu'
  KeyPath   = "$env:USERPROFILE\.ssh\planterr.pem"
  RemoteDir = '/opt/planterr'
  Pm2Name   = 'planterr'
  Branch    = 'master'
}
