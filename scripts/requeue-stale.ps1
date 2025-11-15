# 🔄 Requeue Stale Jobs
# Findet Jobs die im "queued" Status hängen und schickt sie erneut zu SQS

param(
    [int]$MaxAgeMinutes = 2,  # Jobs älter als 2 Minuten
    [switch]$DryRun = $false   # Test-Modus: Zeigt nur an, schickt nicht
)

Write-Host "🔄 Requeue Stale Jobs" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Max age: $MaxAgeMinutes minutes" -ForegroundColor Yellow
if ($DryRun) {
    Write-Host "DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
}

# 1. Find stale jobs
Write-Host "`n1. Finding stale queued jobs..." -ForegroundColor Yellow

$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$cutoff = $now - ($MaxAgeMinutes * 60)

$queuedJobs = aws dynamodb scan `
    --table-name proov_jobs `
    --filter-expression "#status = :status" `
    --expression-attribute-names '{"#status":"status"}' `
    --expression-attribute-values '{":status":{"S":"queued"}}' `
    --region eu-central-1 `
    --output json 2>$null

if (-not $queuedJobs) {
    Write-Host "   ❌ Failed to query DynamoDB" -ForegroundColor Red
    exit 1
}

$jobData = $queuedJobs | ConvertFrom-Json
$staleJobs = @()

foreach ($job in $jobData.Items) {
    $createdAt = [int]$job.created_at.N
    if ($createdAt -lt $cutoff) {
        $ageMinutes = [math]::Round(($now - $createdAt) / 60, 1)
        $staleJobs += @{
            job_id = $job.job_id.S
            created_at = $createdAt
            age_minutes = $ageMinutes
            bucket = $job.s3_bucket.S
            key = $job.s3_key.S
        }
    }
}

if ($staleJobs.Count -eq 0) {
    Write-Host "   ✅ No stale jobs found" -ForegroundColor Green
    exit 0
}

Write-Host "   Found $($staleJobs.Count) stale jobs:" -ForegroundColor White
$staleJobs | ForEach-Object {
    Write-Host "   - $($_.job_id) (age: $($_.age_minutes) min)" -ForegroundColor Yellow
}

# 2. Requeue jobs
if ($DryRun) {
    Write-Host "`n2. DRY RUN - Would requeue $($staleJobs.Count) jobs" -ForegroundColor Yellow
    exit 0
}

Write-Host "`n2. Requeuing jobs..." -ForegroundColor Yellow

$QueueUrl = "https://sqs.eu-central-1.amazonaws.com/851725596604/proov-worker-queue"
$requeued = 0
$failed = 0

foreach ($job in $staleJobs) {
    try {
        # Build SQS message
        $message = @{
            job_id = $job.job_id
            tool = "analyze_video_complete"  # Default tool
            agent_args = @{
                file_url = "s3://$($job.bucket)/$($job.key)"
                bucket = $job.bucket
                s3_key = $job.key
            }
        } | ConvertTo-Json -Compress

        # Send to SQS
        aws sqs send-message `
            --queue-url $QueueUrl `
            --message-body $message `
            --region eu-central-1 2>$null | Out-Null

        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Requeued: $($job.job_id)" -ForegroundColor Green
            $requeued++
        } else {
            Write-Host "   ❌ Failed: $($job.job_id)" -ForegroundColor Red
            $failed++
        }
    } catch {
        Write-Host "   ❌ Error requeuing $($job.job_id): $_" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=================================" -ForegroundColor Cyan
Write-Host "Results:" -ForegroundColor Cyan
Write-Host "  Requeued: $requeued" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "White" })

if ($requeued -gt 0) {
    Write-Host "`n✅ Successfully requeued $requeued jobs" -ForegroundColor Green
    Write-Host "Monitor worker logs: .\scripts\dev-logs.ps1 worker" -ForegroundColor Cyan
}
