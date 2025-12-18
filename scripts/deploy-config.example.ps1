# Copie este arquivo para scripts/deploy-config.ps1 e ajuste.
# NÃO commite scripts/deploy-config.ps1 (já está no .gitignore).

@{
  Host      = '18.222.198.84'
  User      = 'ubuntu'
  KeyPath   = "$env:USERPROFILE\.ssh\planterr.pem"
  # SshPort = 22
  # SshConnectTimeoutSeconds = 15
  RemoteDir = '/opt/planterr'
  Pm2Name   = 'planterr'
  # Branch = ''  # vazio = usa o branch atual (main/master)
}
