# Proovid Development Setup Script
# Richtet lokale Entwicklungsumgebung ein

Write-Host "🚀 Proovid Development Setup" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 1. Check Docker Installation
Write-Host "`n1. Checking Docker..." -ForegroundColor Yellow
if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "✅ Docker is installed" -ForegroundColor Green
    docker --version
} else {
    Write-Host "❌ Docker not found!" -ForegroundColor Red
    Write-Host "   Please install Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

# 2. Check Docker Compose
Write-Host "`n2. Checking Docker Compose..." -ForegroundColor Yellow
if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    Write-Host "✅ Docker Compose is installed" -ForegroundColor Green
    docker-compose --version
} else {
    Write-Host "⚠️  Docker Compose not found as standalone, trying docker compose..." -ForegroundColor Yellow
    docker compose version
}

# 3. Check AWS CLI
Write-Host "`n3. Checking AWS CLI..." -ForegroundColor Yellow
if (Get-Command aws -ErrorAction SilentlyContinue) {
    Write-Host "✅ AWS CLI is installed" -ForegroundColor Green
    aws --version
    
    # Check AWS credentials
    try {
        $identity = aws sts get-caller-identity 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ AWS credentials configured" -ForegroundColor Green
            $identity | ConvertFrom-Json | Format-List
        } else {
            Write-Host "❌ AWS credentials not configured" -ForegroundColor Red
            Write-Host "   Run: aws configure" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️  Could not verify AWS credentials" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ AWS CLI not found!" -ForegroundColor Red
    Write-Host "   Install: https://aws.amazon.com/cli/" -ForegroundColor Yellow
}

# 4. Create .env file if not exists
Write-Host "`n4. Checking .env file..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ .env file exists" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file not found, creating from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Created .env file - PLEASE EDIT IT WITH YOUR CREDENTIALS!" -ForegroundColor Yellow
}

# 5. Build Docker images
Write-Host "`n5. Building Docker images..." -ForegroundColor Yellow
Write-Host "   This may take a few minutes on first run..." -ForegroundColor Cyan
docker-compose -f docker-compose.dev.yml build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker images built successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Docker build failed" -ForegroundColor Red
    exit 1
}

# 6. Success message
Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "✅ Development Setup Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env file with your AWS credentials" -ForegroundColor White
Write-Host "  2. Run: .\scripts\dev-start.ps1" -ForegroundColor White
Write-Host "  3. Backend will be at: http://localhost:8000" -ForegroundColor White
Write-Host "  4. API docs at: http://localhost:8000/docs" -ForegroundColor White
Write-Host "`nFor debugging:" -ForegroundColor Cyan
Write-Host "  - View logs: docker-compose -f docker-compose.dev.yml logs -f" -ForegroundColor White
Write-Host "  - Stop: .\scripts\dev-stop.ps1" -ForegroundColor White
