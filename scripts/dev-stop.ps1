# Stop Development Environment
Write-Host "⏹️  Stopping Proovid Development Environment..." -ForegroundColor Cyan

docker-compose -f docker-compose.dev.yml down

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Services stopped successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to stop services" -ForegroundColor Red
    exit 1
}
