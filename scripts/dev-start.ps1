# Start Development Environment
Write-Host "🚀 Starting Proovid Development Environment..." -ForegroundColor Cyan

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "   Run: .\scripts\dev-setup.ps1 first" -ForegroundColor Yellow
    exit 1
}

# Start services
Write-Host "Starting services..." -ForegroundColor Yellow
docker-compose -f docker-compose.dev.yml up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Services started successfully!" -ForegroundColor Green
    Write-Host "`nAccess points:" -ForegroundColor Cyan
    Write-Host "  Backend API: http://localhost:8000" -ForegroundColor White
    Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
    Write-Host "  Health: http://localhost:8000/health" -ForegroundColor White
    
    Write-Host "`nUseful commands:" -ForegroundColor Cyan
    Write-Host "  View logs: docker-compose -f docker-compose.dev.yml logs -f" -ForegroundColor White
    Write-Host "  View backend logs: docker-compose -f docker-compose.dev.yml logs -f backend" -ForegroundColor White
    Write-Host "  View worker logs: docker-compose -f docker-compose.dev.yml logs -f worker" -ForegroundColor White
    Write-Host "  Stop: .\scripts\dev-stop.ps1" -ForegroundColor White
    Write-Host "  Restart: docker-compose -f docker-compose.dev.yml restart" -ForegroundColor White
    
    # Show container status
    Write-Host "`nContainer status:" -ForegroundColor Cyan
    docker-compose -f docker-compose.dev.yml ps
    
    # Follow logs
    Write-Host "`nFollowing logs (Ctrl+C to exit)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    docker-compose -f docker-compose.dev.yml logs -f
} else {
    Write-Host "❌ Failed to start services" -ForegroundColor Red
    Write-Host "Check logs with: docker-compose -f docker-compose.dev.yml logs" -ForegroundColor Yellow
    exit 1
}
