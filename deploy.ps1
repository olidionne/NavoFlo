# deploy.ps1 — Commit + Deploy NavoFlo vers navoflo.com
# Usage: .\deploy.ps1 "message de commit"
# Exemple: .\deploy.ps1 "feat: McMaster PN detection v8.24.4"

param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Message
)

Set-Location $PSScriptRoot

Write-Host "`n=== NavoFlo Deploy ===" -ForegroundColor Cyan

# 1. Git commit + push
Write-Host "`n[1/2] Git commit + push..." -ForegroundColor Yellow
git add -A
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  Write-Host "Rien a committer ou erreur git." -ForegroundColor DarkYellow
}
git push origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "Push échoué." -ForegroundColor Red
  exit 1
}

# 2. Wrangler deploy
Write-Host "`n[2/2] Déploiement sur navoflo.com..." -ForegroundColor Yellow
npx wrangler deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host "Déploiement wrangler échoué." -ForegroundColor Red
  exit 1
}

Write-Host "`n✅ Déployé sur https://navoflo.com" -ForegroundColor Green
