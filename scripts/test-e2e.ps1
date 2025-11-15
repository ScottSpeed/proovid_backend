#!/usr/bin/env pwsh
# 🧪 End-to-End Test für kompletten Upload/Analyse/Chat Flow

param(
    [string]$TestVideo = "test_video.mp4",
    [string]$Token = ""  # JWT Token für Auth
)

Write-Host "🧪 End-to-End Test" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

if (-not $Token) {
    Write-Host "❌ Please provide JWT token:" -ForegroundColor Red
    Write-Host "   .\scripts\test-e2e.ps1 -Token 'YOUR_JWT_TOKEN'" -ForegroundColor Yellow
    exit 1
}

$BaseUrl = "http://localhost:8000"
$Headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

# 1. Health Check
Write-Host "`n1. Testing API health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    Write-Host "   ✅ API is healthy: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "   ❌ API not reachable!" -ForegroundColor Red
    Write-Host "   Start with: .\scripts\dev-start.ps1" -ForegroundColor Yellow
    exit 1
}

# 2. Start Upload Session
Write-Host "`n2. Creating upload session..." -ForegroundColor Yellow
try {
    $session = Invoke-RestMethod -Uri "$BaseUrl/upload-session" -Method Post -Headers $Headers
    $SessionId = $session.session_id
    Write-Host "   ✅ Session created: $SessionId" -ForegroundColor Green
    Write-Host "   S3 Prefix: $($session.s3_prefix)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Failed to create session: $_" -ForegroundColor Red
    exit 1
}

# 3. Get Upload URL
Write-Host "`n3. Requesting upload URL..." -ForegroundColor Yellow
try {
    $uploadRequest = @{
        bucket = "christian-aws-development"
        key = "test-videos/$TestVideo"
        content_type = "video/mp4"
        session_id = $SessionId
    } | ConvertTo-Json

    $uploadUrl = Invoke-RestMethod -Uri "$BaseUrl/get-upload-url" -Method Post -Headers $Headers -Body $uploadRequest
    Write-Host "   ✅ Upload URL generated" -ForegroundColor Green
    Write-Host "   Key: $($uploadUrl.key)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Failed to get upload URL: $_" -ForegroundColor Red
    exit 1
}

# 4. Simulate video upload (skip actual upload in test)
Write-Host "`n4. [SIMULATED] Uploading video..." -ForegroundColor Yellow
Write-Host "   In real scenario: Upload video to presigned URL" -ForegroundColor Cyan
Write-Host "   ✅ Upload would happen here" -ForegroundColor Green

# 5. Start Analysis
Write-Host "`n5. Starting video analysis..." -ForegroundColor Yellow
try {
    $analyzeRequest = @{
        videos = @(
            @{
                bucket = "christian-aws-development"
                key = $uploadUrl.key
                tool = "analyze_video_complete"
            }
        )
        session_id = $SessionId
    } | ConvertTo-Json

    $analysis = Invoke-RestMethod -Uri "$BaseUrl/analyze" -Method Post -Headers $Headers -Body $analyzeRequest -ContentType "application/json"
    $JobId = $analysis.jobs[0].job_id
    Write-Host "   ✅ Analysis started" -ForegroundColor Green
    Write-Host "   Job ID: $JobId" -ForegroundColor White
} catch {
    Write-Host "   ❌ Failed to start analysis: $_" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    exit 1
}

# 6. Poll Job Status
Write-Host "`n6. Polling job status..." -ForegroundColor Yellow
$maxAttempts = 30  # 30 seconds max
$attempt = 0
$status = "queued"

while ($attempt -lt $maxAttempts -and $status -ne "done" -and $status -ne "completed" -and $status -ne "error") {
    Start-Sleep -Seconds 1
    $attempt++
    
    try {
        $statusRequest = @{
            job_ids = @($JobId)
        } | ConvertTo-Json

        $statusResponse = Invoke-RestMethod -Uri "$BaseUrl/job-status" -Method Post -Headers $Headers -Body $statusRequest -ContentType "application/json"
        $status = $statusResponse.statuses[0].status
        
        Write-Host "   [$attempt/$maxAttempts] Status: $status" -ForegroundColor $(if ($status -eq "done" -or $status -eq "completed") { "Green" } elseif ($status -eq "error") { "Red" } else { "Yellow" })
    } catch {
        Write-Host "   ⚠️  Status check failed: $_" -ForegroundColor Yellow
    }
}

if ($status -eq "done" -or $status -eq "completed") {
    Write-Host "   ✅ Analysis completed!" -ForegroundColor Green
} elseif ($status -eq "error") {
    Write-Host "   ❌ Analysis failed!" -ForegroundColor Red
    exit 1
} else {
    Write-Host "   ⚠️  Analysis timed out (still $status)" -ForegroundColor Yellow
}

# 7. Test Chat with Session Context
Write-Host "`n7. Testing chat with session context..." -ForegroundColor Yellow
try {
    $chatRequest = @{
        message = "Welche Videos habe ich in dieser Session hochgeladen?"
        session_id = $SessionId
    } | ConvertTo-Json

    $chatResponse = Invoke-RestMethod -Uri "$BaseUrl/chat" -Method Post -Headers $Headers -Body $chatRequest -ContentType "application/json"
    Write-Host "   ✅ Chat response received" -ForegroundColor Green
    Write-Host "   Response: $($chatResponse.response.Substring(0, [Math]::Min(200, $chatResponse.response.Length)))..." -ForegroundColor White
    Write-Host "   Matched videos: $($chatResponse.matched_videos.Count)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Chat failed: $_" -ForegroundColor Red
}

# 8. Test Chat without Session (should get all user videos)
Write-Host "`n8. Testing chat without session filter..." -ForegroundColor Yellow
try {
    $chatRequest = @{
        message = "Welche Videos habe ich insgesamt hochgeladen?"
    } | ConvertTo-Json

    $chatResponse = Invoke-RestMethod -Uri "$BaseUrl/chat" -Method Post -Headers $Headers -Body $chatRequest -ContentType "application/json"
    Write-Host "   ✅ Chat response received" -ForegroundColor Green
    Write-Host "   Response: $($chatResponse.response.Substring(0, [Math]::Min(200, $chatResponse.response.Length)))..." -ForegroundColor White
    Write-Host "   Matched videos: $($chatResponse.matched_videos.Count)" -ForegroundColor White
} catch {
    Write-Host "   ❌ Chat failed: $_" -ForegroundColor Red
}

# Summary
Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "✅ End-to-End Test Complete!" -ForegroundColor Green
Write-Host "`nTest Results:" -ForegroundColor Cyan
Write-Host "  Session ID: $SessionId" -ForegroundColor White
Write-Host "  Job ID: $JobId" -ForegroundColor White
Write-Host "  Final Status: $status" -ForegroundColor White

Write-Host "`nNext Steps:" -ForegroundColor Cyan
Write-Host "  1. Check logs: .\scripts\dev-logs.ps1" -ForegroundColor White
Write-Host "  2. Verify user_id filtering in logs" -ForegroundColor White
Write-Host "  3. Test with different user tokens" -ForegroundColor White
