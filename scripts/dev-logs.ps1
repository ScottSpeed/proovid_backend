# View Development Logs
param(
    [string]$Service = "all"
)

Write-Host "📋 Viewing logs for: $Service" -ForegroundColor Cyan

if ($Service -eq "all") {
    docker-compose -f docker-compose.dev.yml logs -f
} else {
    docker-compose -f docker-compose.dev.yml logs -f $Service
}
