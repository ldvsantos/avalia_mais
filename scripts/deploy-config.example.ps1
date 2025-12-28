# Copie este arquivo para scripts/deploy-config.ps1 e ajuste.
# NÃO commite scripts/deploy-config.ps1 (já está no .gitignore).

@{
  Host      = '13.59.96.218'
  User      = 'ubuntu'
  KeyPath   = "$env:USERPROFILE\.ssh\planterr.pem"
  # SshPort = 22
  # SshConnectTimeoutSeconds = 15
  RemoteDir = '/opt/planterr'
  Pm2Name   = 'planterr'
  # Branch = ''  # vazio = usa o branch atual (main/master)
}
