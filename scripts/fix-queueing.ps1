# 🔧 Quick Fix: Video Queueing Issues
# Dieses Script hilft beim Debuggen warum Videos nicht gequed werden

Write-Host "📋 Video Queueing Diagnostics" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# 1. Check API logs for enqueue attempts
Write-Host "`n1. Checking recent enqueue attempts..." -ForegroundColor Yellow

if (docker ps --filter "name=backend" -q) {
    Write-Host "   Searching backend logs for 'Enqueuing job'..." -ForegroundColor Cyan
    docker-compose -f docker-compose.dev.yml logs backend --tail=100 2>$null | Select-String "Enqueuing job"
} else {
    Write-Host "   ⚠️  Backend container not running!" -ForegroundColor Yellow
    Write-Host "   Start with: .\scripts\dev-start.ps1" -ForegroundColor White
}

# 2. Check for enqueue errors
Write-Host "`n2. Checking for enqueue errors..." -ForegroundColor Yellow

if (docker ps --filter "name=backend" -q) {
    $errors = docker-compose -f docker-compose.dev.yml logs backend --tail=200 2>$null | Select-String "enqueue.*failed|Failed to send SQS|SQS.*error"
    if ($errors) {
        Write-Host "   ❌ Found enqueue errors:" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
    } else {
        Write-Host "   ✅ No enqueue errors in recent logs" -ForegroundColor Green
    }
}

# 3. Check DynamoDB for enqueue error markers
Write-Host "`n3. Checking DynamoDB for failed enqueue attempts..." -ForegroundColor Yellow

$failedEnqueues = aws dynamodb scan `
    --table-name proov_jobs `
    --filter-expression "attribute_exists(enqueue_last_error)" `
    --projection-expression "job_id, enqueue_last_error, enqueue_attempts" `
    --region eu-central-1 `
    --output json 2>$null

if ($failedEnqueues) {
    $data = $failedEnqueues | ConvertFrom-Json
    if ($data.Items.Count -gt 0) {
        Write-Host "   ❌ Found $($data.Items.Count) jobs with enqueue errors!" -ForegroundColor Red
        $data.Items | ForEach-Object {
            Write-Host "   - Job: $($_.job_id.S)" -ForegroundColor White
            Write-Host "     Error: $($_.enqueue_last_error.S)" -ForegroundColor Yellow
            Write-Host "     Attempts: $($_.enqueue_attempts.N)" -ForegroundColor White
        }
    } else {
        Write-Host "   ✅ No jobs with enqueue errors" -ForegroundColor Green
    }
}

# 4. Check SQS queue attributes
Write-Host "`n4. Checking SQS queue status..." -ForegroundColor Yellow

$QueueUrl = "https://sqs.eu-central-1.amazonaws.com/851725596604/proov-worker-queue"
$attrs = aws sqs get-queue-attributes `
    --queue-url $QueueUrl `
    --attribute-names ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible `
    --region eu-central-1 `
    --output json 2>$null

if ($attrs) {
    $queueData = $attrs | ConvertFrom-Json
    $visible = $queueData.Attributes.ApproximateNumberOfMessages
    $inflight = $queueData.Attributes.ApproximateNumberOfMessagesNotVisible
    
    Write-Host "   Messages in queue: $visible" -ForegroundColor White
    Write-Host "   Messages in flight: $inflight" -ForegroundColor White
    
    if ([int]$visible -gt 10) {
        Write-Host "   ⚠️  High message count - worker might be slow!" -ForegroundColor Yellow
    }
}

# 5. Check worker status
Write-Host "`n5. Checking worker status..." -ForegroundColor Yellow

if (docker ps --filter "name=worker" -q) {
    Write-Host "   ✅ Worker container is running" -ForegroundColor Green
    
    # Check last polling attempt
    $lastPoll = docker-compose -f docker-compose.dev.yml logs worker --tail=50 2>$null | Select-String "Polling SQS" | Select-Object -Last 1
    if ($lastPoll) {
        Write-Host "   Last poll: $lastPoll" -ForegroundColor White
    }
    
    # Check for processing messages
    $processing = docker-compose -f docker-compose.dev.yml logs worker --tail=100 2>$null | Select-String "Processing message|Job.*completed"
    if ($processing) {
        Write-Host "   ✅ Worker is processing jobs" -ForegroundColor Green
        $processing | Select-Object -Last 3 | ForEach-Object { Write-Host "   $_" -ForegroundColor White }
    } else {
        Write-Host "   ⚠️  No recent job processing detected!" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ Worker container NOT running!" -ForegroundColor Red
    Write-Host "   Start with: .\scripts\dev-start.ps1" -ForegroundColor White
}

# 6. Common issues and fixes
Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Common Issues & Fixes:" -ForegroundColor Cyan

Write-Host "`n❌ Issue: Videos not enqueued to SQS" -ForegroundColor Yellow
Write-Host "   Fix: Check backend logs for 'Failed to send SQS message'" -ForegroundColor White
Write-Host "   Command: docker-compose -f docker-compose.dev.yml logs backend | Select-String 'SQS'" -ForegroundColor Cyan

Write-Host "`n❌ Issue: Worker not processing" -ForegroundColor Yellow
Write-Host "   Fix 1: Restart worker: docker-compose -f docker-compose.dev.yml restart worker" -ForegroundColor White
Write-Host "   Fix 2: Check credentials: docker-compose -f docker-compose.dev.yml exec worker env | Select-String 'AWS'" -ForegroundColor Cyan

Write-Host "`n❌ Issue: Jobs stuck in 'queued' status" -ForegroundColor Yellow
Write-Host "   Fix: Run requeue script: .\scripts\requeue-stale.ps1" -ForegroundColor White

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Debug commands:" -ForegroundColor Cyan
Write-Host "  .\scripts\debug-queue.ps1        - Detailed queue analysis" -ForegroundColor White
Write-Host "  .\scripts\dev-logs.ps1 backend   - Watch backend logs" -ForegroundColor White
Write-Host "  .\scripts\dev-logs.ps1 worker    - Watch worker logs" -ForegroundColor White
