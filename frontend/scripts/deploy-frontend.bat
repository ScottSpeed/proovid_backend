@echo off
REM 🚀 Windows PowerShell Deploy Script for Frontend

echo 🏗️  Building and deploying frontend...

REM Configuration
set BUCKET_NAME=frontend-deploy-1756677679
set CLOUDFRONT_DISTRIBUTION_ID=EQ43E3L88MMF9
set AWS_REGION=eu-central-1

REM Build the frontend
echo 📦 Building React app...
call npm run build

REM Check if build was successful
if not exist "dist" (
  echo ❌ Build failed - dist directory not found!
  exit /b 1
)

echo 🚀 Deploying to S3...

REM Sync built files to S3
aws s3 sync dist/ s3://%BUCKET_NAME% --delete

REM Invalidate CloudFront cache if distribution ID is provided
if not "%CLOUDFRONT_DISTRIBUTION_ID%"=="" (
  echo 🔄 Invalidating CloudFront cache...
  aws cloudfront create-invalidation --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --paths "/*"
)

echo ✅ Deployment complete!
echo 🌐 Your app is live at: https://proovid.ai