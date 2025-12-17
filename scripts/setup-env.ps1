param(
    [Parameter(Mandatory = $true)]
    [string]$SmtpUser,

    [Parameter(Mandatory = $true)]
    [string]$SmtpPass,

    [string]$SmtpHost = "smtp.gmail.com",
    [string]$SmtpPort = "587",
    [string]$SmtpSecure = "false",
    [string]$SmtpFrom = '"Avalia Mais" <noreply@avalia.com>',

    [string]$AdminNotifyTo = '',

    [string]$Server = '13.59.123.67',
    [string]$User = 'ubuntu',
    [string]$KeyPath = "$env:USERPROFILE\.ssh\planterr.pem"
)

$envContent = "SMTP_HOST=$SmtpHost`nSMTP_PORT=$SmtpPort`nSMTP_USER=$SmtpUser`nSMTP_PASS=$SmtpPass`nSMTP_SECURE=$SmtpSecure`nSMTP_FROM=$SmtpFrom"

if ($AdminNotifyTo) {
    $envContent = "$envContent`nADMIN_NOTIFY_TO=$AdminNotifyTo"
}

Write-Host "Configurando variáveis de ambiente no servidor $Server..." -ForegroundColor Cyan

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$tmpLocal = Join-Path $env:TEMP "planterr-env-$timestamp.env"
$tmpRemote = "/tmp/planterr-env-$timestamp.env"

Set-Content -Path $tmpLocal -Value $envContent -Encoding UTF8

try {
    scp -i $KeyPath $tmpLocal "${User}@${Server}:$tmpRemote"
    if ($LASTEXITCODE -ne 0) { throw "Falha no SCP" }

    # Instala o arquivo garantindo owner/permissões corretos (evita ficar root:root e quebrar leitura do dotenv)
    $remoteInstall = "sudo install -o ubuntu -g ubuntu -m 600 '$tmpRemote' /opt/planterr/server/.env && rm -f '$tmpRemote' && echo 'Arquivo .env instalado com sucesso.'"
    ssh -i $KeyPath "${User}@${Server}" $remoteInstall
    if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar .env" }

    Write-Host "Configuração concluída! Reiniciando aplicação..." -ForegroundColor Green
    ssh -i $KeyPath "${User}@${Server}" "sudo -u ubuntu pm2 restart planterr"
} finally {
    if (Test-Path $tmpLocal) { Remove-Item -Force $tmpLocal }
}
