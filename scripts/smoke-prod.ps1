param(
  [string]$BaseUrl = 'https://18.222.198.84',
  [string]$AdminSecret = '4a98a736-811d-447a-bfb3-6f4c2bc0dbc7',
  [string]$AdminUser = 'admin',
  [string]$AdminPass = ''
)

$ErrorActionPreference = 'Stop'

# Evita acentuação quebrada no Windows PowerShell
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {}

function Step([string]$label) {
  Write-Host ("[smoke-prod] {0}" -f $label)
}

$jar = Join-Path $env:TEMP ("planterr-smoke-cookies-{0}.txt" -f [guid]::NewGuid())
$headersFile = Join-Path $env:TEMP ("planterr-smoke-headers-{0}.txt" -f [guid]::NewGuid())

$title = "SMOKE-PROD {0}" -f (Get-Date -Format 'yyyyMMdd-HHmmss')
$yesterday = (Get-Date).AddDays(-1)
$dateStr = $yesterday.ToString('yyyy-MM-dd')
$cpf = (Get-Random -Minimum 10000000000 -Maximum 99999999999).ToString()

if (-not $AdminPass -or -not $AdminPass.Trim()) {
  $sec = Read-Host -Prompt "Senha do admin ($AdminUser)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try {
    $AdminPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

Step "1) Login admin ($AdminUser)"
$loginUrl = "$BaseUrl/secret/$AdminSecret/login"
$loginObj = $null

# Tentativa A: JSON
$loginPayloadJson = @{ username = $AdminUser; password = $AdminPass } | ConvertTo-Json -Compress
$loginRespRaw = & curl.exe -k -s -X POST $loginUrl -H "Content-Type: application/json" -b $jar -c $jar --data-raw $loginPayloadJson
try { $loginObj = $loginRespRaw | ConvertFrom-Json } catch {}

# Tentativa B (fallback): form-urlencoded (para ambientes onde JSON dá 400)
if (-not $loginObj -or -not $loginObj.success) {
  $loginForm = "username=$([uri]::EscapeDataString($AdminUser))&password=$([uri]::EscapeDataString($AdminPass))"
  $loginRespRaw = & curl.exe -k -s -X POST $loginUrl -H "Content-Type: application/x-www-form-urlencoded" -b $jar -c $jar --data-raw $loginForm
  $loginObj = $null
  try { $loginObj = $loginRespRaw | ConvertFrom-Json } catch {}
}

if (-not $loginObj -or -not $loginObj.success) {
  Write-Host "[smoke-prod] Login falhou. Resposta: $loginRespRaw" -ForegroundColor Yellow
  throw "Não foi possível autenticar. Informe credenciais corretas (AdminUser/AdminPass) e rode novamente." 
}
Step "OK login"

Step "2) Criar evento temporário (sem imagem)"
$activities = '[{"name":"Atividade","role":"PARTICIPANTE","workload":1}]'
$form = "title=$([uri]::EscapeDataString($title))" +
  "&description=evento%20de%20teste%20automatizado" +
  "&date=$dateStr" +
  "&location=Local%20Teste" +
  "&workload=1%20hora(s)" +
  "&status=open" +
  "&coordinator=Coord" +
  "&department=Dept" +
  "&speakers=Speaker" +
  "&participantRole=PARTICIPANTE" +
  "&syllabus=Ementa" +
  "&activities=$([uri]::EscapeDataString($activities))"
$createUrl = "$BaseUrl/secret/$AdminSecret/admin/events"
$createCode = & curl.exe -k -s -o NUL -w "%{http_code}" -X POST $createUrl -H "Content-Type: application/x-www-form-urlencoded" -b $jar -c $jar --data-raw $form
Step "create status=$createCode"
if ($createCode -notin @('200', '302')) { throw "Falha ao criar evento: HTTP $createCode" }

Step "3) Encontrar eventId em /api/public-events"
$eventsJson = & curl.exe -k -s "$BaseUrl/api/public-events"
$events = $eventsJson | ConvertFrom-Json
$found = $events | Where-Object { $_.title -eq $title } | Select-Object -First 1
if (-not $found -or -not $found.id) { throw "Evento não apareceu em public-events" }
$eventId = [string]$found.id
Step "eventId=$eventId"

Step "4) Página do evento usa post_padrao.png"
$eventHtml = ((& curl.exe -k -s "$BaseUrl/eventos/$eventId") -join "`n")
if ($eventHtml -notmatch '/img/post_padrao\.png') { throw "post_padrao.png não encontrado na página do evento" }
Step "OK default poster"

Step "5) Inscrever CPF=$cpf"
$inscUrl = "$BaseUrl/eventos/$eventId/inscrever"
$inscForm = "nome=Teste%20Smoke&email=smoke%40test.local&cpf=$cpf"
$inscCode = & curl.exe -k -s -o NUL -w "%{http_code}" -X POST $inscUrl -H "Content-Type: application/x-www-form-urlencoded" --data-raw $inscForm
Step "inscricao status=$inscCode"
if ($inscCode -notin @('200', '302')) { throw "Falha ao inscrever: HTTP $inscCode" }

Step "6) Certificado deve bloquear antes de confirmar (403)"
$certUrl = "$BaseUrl/eventos/$eventId/certificado"
$certBefore = & curl.exe -k -s -o NUL -w "%{http_code}" -X POST $certUrl -H "Content-Type: application/x-www-form-urlencoded" --data-raw "cpf=$cpf"
Step "cert antes status=$certBefore"
if ($certBefore -ne '403') { throw "Esperado 403 antes da presença; veio $certBefore" }

Step "7) Admin confirma presença (index 0)"
$toggleUrl = "$BaseUrl/secret/$AdminSecret/admin/events/$eventId/registrations/0/toggle-confirm"
$toggleCode = & curl.exe -k -s -o NUL -w "%{http_code}" -X POST $toggleUrl -b $jar -c $jar
Step "toggle status=$toggleCode"
if ($toggleCode -notin @('200', '302')) { throw "Falha no toggle: HTTP $toggleCode" }

Step "8) Certificado deve retornar PDF"
& curl.exe -k -s -D $headersFile -o NUL -X POST $certUrl -H "Content-Type: application/x-www-form-urlencoded" --data-raw "cpf=$cpf"
$ctLine = (Get-Content $headersFile | Where-Object { $_ -match '^Content-Type:' } | Select-Object -First 1)
Step "$ctLine"
if (-not $ctLine -or $ctLine -notmatch 'application/pdf') { throw "Content-Type esperado application/pdf; veio: $ctLine" }

Step "9) Excluir evento temporário"
$delUrl = "$BaseUrl/secret/$AdminSecret/admin/events/$eventId/delete"
$delCode = & curl.exe -k -s -o NUL -w "%{http_code}" -X POST $delUrl -b $jar -c $jar
Step "delete status=$delCode"
if ($delCode -notin @('200', '302')) { throw "Falha ao excluir: HTTP $delCode" }

Step "10) Confirmar removido"
$eventsJson2 = & curl.exe -k -s "$BaseUrl/api/public-events"
$events2 = $eventsJson2 | ConvertFrom-Json
$still = $events2 | Where-Object { $_.id -eq $eventId } | Select-Object -First 1
if ($still) { throw "Evento ainda aparece após delete" }

Step "SUCESSO (funcional)" 
