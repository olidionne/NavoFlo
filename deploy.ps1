# deploy.ps1 — Commit + Push NavoFlo (le déploiement est automatique via GitHub)
# Usage: .\deploy.ps1 "message de commit"
# Exemple: .\deploy.ps1 "feat: McMaster PN detection v8.24.4"

param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Message
)

Set-Location $PSScriptRoot

Write-Host "`n=== NavoFlo Deploy ===" -ForegroundColor Cyan

git add -A
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  Write-Host "Rien a committer." -ForegroundColor DarkYellow
}
git push origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "Push échoué." -ForegroundColor Red
  exit 1
}

Write-Host "`nOK — Pousse vers GitHub, deploiement automatique sur https://navoflo.com" -ForegroundColor Green
