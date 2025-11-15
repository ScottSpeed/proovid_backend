# Debug SQS Queue - Check for stuck jobs
Write-Host "🔍 Debugging SQS Queue..." -ForegroundColor Cyan

$QueueUrl = "https://sqs.eu-central-1.amazonaws.com/851725596604/proov-worker-queue"

Write-Host "`nQueue URL: $QueueUrl" -ForegroundColor Yellow

# Get queue attributes
Write-Host "`n1. Checking queue attributes..." -ForegroundColor Cyan
aws sqs get-queue-attributes `
    --queue-url $QueueUrl `
    --attribute-names All `
    --region eu-central-1 `
    --output json | ConvertFrom-Json | Format-List

# Check for messages
Write-Host "`n2. Checking for messages..." -ForegroundColor Cyan
$messages = aws sqs receive-message `
    --queue-url $QueueUrl `
    --max-number-of-messages 10 `
    --region eu-central-1 `
    --output json 2>$null

if ($messages) {
    $msgData = $messages | ConvertFrom-Json
    if ($msgData.Messages) {
        Write-Host "⚠️  Found $($msgData.Messages.Count) messages in queue:" -ForegroundColor Yellow
        $msgData.Messages | ForEach-Object {
            $body = $_.Body | ConvertFrom-Json
            Write-Host "   - Job ID: $($body.job_id)" -ForegroundColor White
            Write-Host "     Tool: $($body.tool)" -ForegroundColor White
        }
    } else {
        Write-Host "✅ Queue is empty" -ForegroundColor Green
    }
} else {
    Write-Host "✅ Queue is empty" -ForegroundColor Green
}

# Check DynamoDB for queued jobs
Write-Host "`n3. Checking DynamoDB for queued jobs..." -ForegroundColor Cyan
$queuedJobs = aws dynamodb scan `
    --table-name proov_jobs `
    --filter-expression "#status = :status" `
    --expression-attribute-names '{"#status":"status"}' `
    --expression-attribute-values '{":status":{"S":"queued"}}' `
    --region eu-central-1 `
    --output json 2>$null

if ($queuedJobs) {
    $jobData = $queuedJobs | ConvertFrom-Json
    if ($jobData.Items -and $jobData.Items.Count -gt 0) {
        Write-Host "⚠️  Found $($jobData.Items.Count) jobs in 'queued' status:" -ForegroundColor Yellow
        $jobData.Items | ForEach-Object {
            Write-Host "   - Job ID: $($_.job_id.S)" -ForegroundColor White
            Write-Host "     Created: $($_.created_at.N)" -ForegroundColor White
        }
        
        # Calculate age of oldest job
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
        $oldest = $jobData.Items | ForEach-Object { [int]$_.created_at.N } | Measure-Object -Minimum
        $ageSeconds = $now - $oldest.Minimum
        $ageMinutes = [math]::Round($ageSeconds / 60, 1)
        
        Write-Host "`n   Oldest queued job: $ageMinutes minutes ago" -ForegroundColor Yellow
        
        if ($ageSeconds -gt 120) {
            Write-Host "`n   ⚠️  WARNING: Jobs older than 2 minutes detected!" -ForegroundColor Red
            Write-Host "   Possible issues:" -ForegroundColor Yellow
            Write-Host "   1. Worker not running" -ForegroundColor White
            Write-Host "   2. Worker crashed" -ForegroundColor White
            Write-Host "   3. SQS visibility timeout too long" -ForegroundColor White
            Write-Host "   4. Jobs not being enqueued to SQS" -ForegroundColor White
        }
    } else {
        Write-Host "✅ No jobs in 'queued' status" -ForegroundColor Green
    }
}

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Debug complete!" -ForegroundColor Green
