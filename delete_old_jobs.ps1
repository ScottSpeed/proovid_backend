$jobs = @(
    "ed312268-148c-4bd6-80d5-40f743bc180a",
    "a9652987-7524-4787-91ba-15134402b642",
    "6a5bb27b-c22f-49f4-bd4d-65559fac9ceb",
    "eae89dc1-ab14-4021-9a3f-4957f736591e",
    "ec5aa8c3-8e77-4a7c-8ec4-37b471344447",
    "0a3809dc-0885-4866-b09e-0e985cd6ceed",
    "afd10a6a-ab3d-44a6-95c4-c84969a46919",
    "169935b2-a208-4808-b5e7-650e26d96296",
    "e8e448ba-bc33-4e2b-a562-b0c8c35913c0",
    "d97f9e11-263d-4638-be3c-50939a5f0b66",
    "5ca7edaf-a210-47f5-9033-ca52fb2c0262",
    "a50c54a0-89a1-4bb9-af33-8353577db612",
    "7d470c9f-06e6-44e9-bec9-41117ee080e5",
    "42b8c5d0-19ae-441b-aa7e-8b4adfc07571",
    "97682960-498e-4371-806d-6556d8a9ba45",
    "c186fd1e-799d-4752-95d8-d1ffef2d51d2",
    "d54d4a6e-a8c5-4702-a4c0-58aa358a02a3",
    "efea46d8-2e0d-4c5b-aba3-0d2d6ebb2f37",
    "f3658e84-d117-4b54-9bf4-1eaaecf6b566",
    "fff1f024-3360-495e-9e53-7eb7ac7ac01a"
)

$count = 0
foreach($job in $jobs) {
    # Create temp JSON file
    $tempFile = "temp_key_$job.json"
    @{
        job_id = @{
            S = $job
        }
    } | ConvertTo-Json -Compress | Out-File -FilePath $tempFile -Encoding utf8
    
    aws dynamodb delete-item --table-name proov_jobs --key "file://$tempFile" --region eu-central-1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deleted: $job" -ForegroundColor Green
        $count++
    } else {
        Write-Host "Failed: $job" -ForegroundColor Red
    }
    
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Cleanup complete! Deleted $count jobs" -ForegroundColor Cyan
