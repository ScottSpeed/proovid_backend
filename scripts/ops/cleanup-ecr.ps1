param(
    [int]$Days = 45,
    [int]$Keep = 3,
    [string[]]$Repos = @('backend','worker','frontend'),
    [string]$Region = 'eu-central-1'
)

$ErrorActionPreference = 'Stop'

Write-Host "Cleaning up ECR images in region $Region..." -ForegroundColor Cyan

function Remove-UntaggedImages {
    param([string]$Repo)
    Write-Host "Cleaning UNTAGGED images in $Repo..." -ForegroundColor Yellow
    $idsPath = Join-Path $env:TEMP "ecr-$Repo-untagged.json"
    $json = aws ecr list-images --region $Region --repository-name $Repo --filter tagStatus=UNTAGGED --query 'imageIds' --output json
    if ($json -and $json.Trim() -ne '[]') {
        $json | Out-File -FilePath $idsPath -Encoding ascii
        aws ecr batch-delete-image --region $Region --repository-name $Repo --image-ids file://$idsPath | Out-Host
    } else {
        Write-Host "No untagged images in $Repo" -ForegroundColor DarkGray
    }
}

function Remove-OldTaggedImages {
    param([string]$Repo, [int]$Days, [int]$Keep)
    $cutoff = (Get-Date).AddDays(-$Days)
    Write-Host "Scanning $Repo for TAGGED images older than $Days days (< $($cutoff.ToString('u')))" -ForegroundColor Yellow
    $details = (aws ecr describe-images --region $Region --repository-name $Repo --query 'imageDetails' --output json | ConvertFrom-Json)
    if (-not $details) { Write-Host "No images in $Repo" -ForegroundColor DarkGray; return }

    $tagged = $details | Where-Object { $_.imageTags -ne $null -and $_.imageTags.Count -gt 0 -and $_.imagePushedAt -ne $null }
    $sorted = $tagged | Sort-Object -Property {[DateTime]$_.imagePushedAt} -Descending
    $protect = $sorted | Select-Object -First $Keep

    $toDelete = @()
    foreach ($img in $sorted) {
        $pushed = [DateTime]$img.imagePushedAt
        $tags = @($img.imageTags)
        $isProtected = ($protect | Where-Object { $_.imageDigest -eq $img.imageDigest }).Count -gt 0
        if ($pushed -lt $cutoff -and ($tags -notcontains 'latest') -and ($tags -notcontains 'fixed') -and -not $isProtected) {
            $toDelete += @{ imageDigest = $img.imageDigest }
        }
    }

    if ($toDelete.Count -gt 0) {
        $path = Join-Path $env:TEMP "ecr-$Repo-old.json"
        ($toDelete | ConvertTo-Json -Depth 5) | Out-File -FilePath $path -Encoding ascii
        aws ecr batch-delete-image --region $Region --repository-name $Repo --image-ids file://$path | Out-Host
    } else {
        Write-Host "No old tagged images to delete in $Repo" -ForegroundColor DarkGray
    }
}

foreach ($r in $Repos) {
    Remove-UntaggedImages -Repo $r
}

foreach ($r in $Repos) {
    Remove-OldTaggedImages -Repo $r -Days $Days -Keep $Keep
}

Write-Host "✅ ECR cleanup finished" -ForegroundColor Green
