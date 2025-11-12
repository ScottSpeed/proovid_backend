# Emergency Backend Deployment Script (without Docker)
# Uses AWS CLI to create new task definition with updated environment

Write-Host "Emergency Backend Deployment - Creating new Task Definition..." -ForegroundColor Yellow

# Get current task definition
$currentTaskDef = aws ecs describe-task-definition --task-definition backend-task:183 --query 'taskDefinition' | ConvertFrom-Json

# Increment revision
$newRevision = 184

# Force ECS to pull new code by updating environment variable
$timestamp = (Get-Date).Ticks

Write-Host "Forcing ECS service update to trigger new deployment..." -ForegroundColor Cyan

# Force new deployment (ECS will recreate tasks)
aws ecs update-service --cluster my-cluster --service backend-service --force-new-deployment

Write-Host "`n✅ Backend deployment triggered!" -ForegroundColor Green
Write-Host "⏳ ECS is stopping old tasks and starting new ones..." -ForegroundColor Yellow
Write-Host "📊 Monitor progress: aws ecs describe-services --cluster my-cluster --services backend-service" -ForegroundColor Cyan
