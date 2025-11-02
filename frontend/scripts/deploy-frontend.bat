@echo off
REM 🚀 Windows PowerShell Deploy Script for Frontend

echo 🏗️  Building and deploying frontend...

REM Configuration
set BUCKET_NAME=proovid-frontend-hosting
set CLOUDFRONT_DISTRIBUTION_ID=

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
echo 🌐 Your app is live at: http://%BUCKET_NAME%.s3-website-eu-central-1.amazonaws.com