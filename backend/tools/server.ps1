param([ValidateSet('start','stop','restart','status')]$cmd='status')

$ErrorActionPreference='Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Split-Path -Parent $Root
Set-Location $Backend

$PidFile = ".\.server.pid"
$LogDir = ".\logs"; if (!(Test-Path $LogDir)) { New-Item -ItemType Directory $LogDir | Out-Null }

function Start-Server {
  if (Test-Path $PidFile) {
    $serverPid = Get-Content $PidFile | Select-Object -First 1
    if (Get-Process -Id $serverPid -ErrorAction SilentlyContinue) {
      "Ya está corriendo. PID: $serverPid"; return
    } else { Remove-Item $PidFile -Force }
  }
  $p = Start-Process -FilePath "node" -ArgumentList "src/server.js" -WorkingDirectory (Get-Location) `
       -WindowStyle Minimized -PassThru -RedirectStandardOutput ".\logs\server.out.log" `
       -RedirectStandardError ".\logs\server.err.log"
  $p.Id | Out-File $PidFile -Encoding ascii -Force
  "Iniciado. PID: $($p.Id)"
}

function Stop-Server {
  if (!(Test-Path $PidFile)) { "No hay PID"; return }
  $pidValue = Get-Content $PidFile | Select-Object -First 1
  if (Get-Process -Id $pidValue -ErrorAction SilentlyContinue) {
    Stop-Process -Id $pidValue -Force; "Detenido PID: $pidValue"
  } else { "PID $pidValue no activo" }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Status-Server {
  if (Test-Path $PidFile) {
    $pidValue = Get-Content $PidFile | Select-Object -First 1
    if (Get-Process -Id $pidValue -ErrorAction SilentlyContinue) { "RUNNING PID: $pidValue" }
    else { "DOWN (PID file huérfano)"; Remove-Item $PidFile -Force }
  } else { "DOWN" }
}

switch ($cmd) {
  'start'   { Start-Server }
  'stop'    { Stop-Server }
  'restart' { Stop-Server; Start-Server }
  'status'  { Status-Server }
}