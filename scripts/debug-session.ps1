# Debug Session Isolation - Check user_id and session_id in DynamoDB
param(
    [string]$UserId = "",
    [string]$SessionId = ""
)

Write-Host "🔍 Debugging Session Isolation..." -ForegroundColor Cyan

if ($UserId) {
    Write-Host "`nFiltering by User ID: $UserId" -ForegroundColor Yellow
    
    # Check jobs for specific user
    Write-Host "`n1. Jobs for user $UserId..." -ForegroundColor Cyan
    $userJobs = aws dynamodb scan `
        --table-name proov_jobs `
        --filter-expression "user_id = :uid" `
        --expression-attribute-values "{\":uid\":{\"S\":\"$UserId\"}}" `
        --region eu-central-1 `
        --output json 2>$null
    
    if ($userJobs) {
        $jobData = $userJobs | ConvertFrom-Json
        Write-Host "   Found $($jobData.Items.Count) jobs for this user" -ForegroundColor White
        
        if ($jobData.Items.Count -gt 0) {
            $jobData.Items | ForEach-Object {
                Write-Host "   - Job: $($_.job_id.S)" -ForegroundColor White
                Write-Host "     Status: $($_.status.S)" -ForegroundColor White
                Write-Host "     Session: $($_.session_id.S)" -ForegroundColor White
                Write-Host "     Video: $($_.s3_key.S)" -ForegroundColor White
            }
        }
    }
}

if ($SessionId) {
    Write-Host "`nFiltering by Session ID: $SessionId" -ForegroundColor Yellow
    
    # Check jobs for specific session
    Write-Host "`n2. Jobs for session $SessionId..." -ForegroundColor Cyan
    $sessionJobs = aws dynamodb scan `
        --table-name proov_jobs `
        --filter-expression "session_id = :sid" `
        --expression-attribute-values "{\":sid\":{\"S\":\"$SessionId\"}}" `
        --region eu-central-1 `
        --output json 2>$null
    
    if ($sessionJobs) {
        $jobData = $sessionJobs | ConvertFrom-Json
        Write-Host "   Found $($jobData.Items.Count) jobs for this session" -ForegroundColor White
        
        if ($jobData.Items.Count -gt 0) {
            $jobData.Items | ForEach-Object {
                Write-Host "   - Job: $($_.job_id.S)" -ForegroundColor White
                Write-Host "     Status: $($_.status.S)" -ForegroundColor White
                Write-Host "     User: $($_.user_id.S)" -ForegroundColor White
                Write-Host "     Video: $($_.s3_key.S)" -ForegroundColor White
            }
        }
    }
}

if (-not $UserId -and -not $SessionId) {
    Write-Host "`nNo filters specified. Checking all jobs..." -ForegroundColor Yellow
    
    # Get all jobs and check for missing user_id or session_id
    Write-Host "`n1. Checking for jobs missing user_id..." -ForegroundColor Cyan
    $missingUserId = aws dynamodb scan `
        --table-name proov_jobs `
        --filter-expression "attribute_not_exists(user_id)" `
        --region eu-central-1 `
        --output json 2>$null
    
    if ($missingUserId) {
        $jobData = $missingUserId | ConvertFrom-Json
        if ($jobData.Items.Count -gt 0) {
            Write-Host "   ⚠️  Found $($jobData.Items.Count) jobs WITHOUT user_id!" -ForegroundColor Red
            $jobData.Items | Select-Object -First 5 | ForEach-Object {
                Write-Host "   - Job: $($_.job_id.S)" -ForegroundColor White
            }
        } else {
            Write-Host "   ✅ All jobs have user_id" -ForegroundColor Green
        }
    }
    
    Write-Host "`n2. Checking for jobs missing session_id..." -ForegroundColor Cyan
    $missingSessionId = aws dynamodb scan `
        --table-name proov_jobs `
        --filter-expression "attribute_not_exists(session_id)" `
        --region eu-central-1 `
        --output json 2>$null
    
    if ($missingSessionId) {
        $jobData = $missingSessionId | ConvertFrom-Json
        if ($jobData.Items.Count -gt 0) {
            Write-Host "   ⚠️  Found $($jobData.Items.Count) jobs WITHOUT session_id!" -ForegroundColor Yellow
            Write-Host "   (This is OK for old jobs)" -ForegroundColor Cyan
        } else {
            Write-Host "   ✅ All jobs have session_id" -ForegroundColor Green
        }
    }
}

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  .\scripts\debug-session.ps1 -UserId 'user-123'" -ForegroundColor White
Write-Host "  .\scripts\debug-session.ps1 -SessionId 'session-456'" -ForegroundColor White
Write-Host "  .\scripts\debug-session.ps1 -UserId 'user-123' -SessionId 'session-456'" -ForegroundColor White
