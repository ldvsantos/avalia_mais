param(
    [Parameter(Mandatory = $true)]
    [string]$SmtpUser,

    [Parameter(Mandatory = $true)]
    [string]$SmtpPass,

    [string]$SmtpHost = "smtp.gmail.com",
    [string]$SmtpPort = "587",
    [string]$SmtpSecure = "false",
    [string]$SmtpFrom = '"Avalia Mais" <noreply@avalia.com>',

    [string]$Server = '13.59.123.67',
    [string]$User = 'ubuntu',
    [string]$KeyPath = "$env:USERPROFILE\.ssh\planterr.pem"
)

$envContent = "SMTP_HOST=$SmtpHost`nSMTP_PORT=$SmtpPort`nSMTP_USER=$SmtpUser`nSMTP_PASS=$SmtpPass`nSMTP_SECURE=$SmtpSecure`nSMTP_FROM=$SmtpFrom"

# Escape for bash
$envContentEscaped = $envContent.Replace("`n", "\n")

Write-Host "Configurando variáveis de ambiente no servidor $Server..." -ForegroundColor Cyan

# Usando printf para garantir quebras de linha corretas e ajustando permissões para o usuário ubuntu
$remoteCommand = "printf '$envContentEscaped' > /opt/planterr/server/.env && chown ubuntu:ubuntu /opt/planterr/server/.env && chmod 600 /opt/planterr/server/.env && echo 'Arquivo .env criado com sucesso.'"

$remoteCommand | ssh -i $KeyPath "${User}@${Server}" "sudo bash -s"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Configuração concluída! Reiniciando aplicação..." -ForegroundColor Green
    ssh -i $KeyPath "${User}@${Server}" "cd /opt/planterr/server && sudo -u ubuntu pm2 restart planterr"
} else {
    Write-Host "Erro ao configurar variáveis." -ForegroundColor Red
}
