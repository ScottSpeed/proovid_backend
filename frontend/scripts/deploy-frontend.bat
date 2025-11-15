@echo off
REM 🚀 Windows Deploy Script for Frontend (robust pathing)

echo 🏗️  Building and deploying frontend...

REM Configuration
set BUCKET_NAME=frontend-deploy-1756677679
set CLOUDFRONT_DISTRIBUTION_ID=EQ43E3L88MMF9
set AWS_REGION=eu-central-1

REM Ensure we run from the frontend folder (script dir is .../frontend/scripts)
pushd "%~dp0.." >nul 2>&1

REM Check if dependencies are installed (skip if node_modules exists and is recent)
if not exist node_modules (
  echo 📦 Installing dependencies...
  if exist package-lock.json (
    call npm ci --prefer-offline || call npm install --legacy-peer-deps
  ) else (
    call npm install --legacy-peer-deps
  )
) else (
  echo ✅ Dependencies already installed, skipping...
)

REM Build the frontend
echo 🧱 Building React app...
call npm run build || (
  echo ❌ Build failed!
  popd >nul 2>&1
  exit /b 1
)

REM Check if build was successful
if not exist "dist" (
  echo ❌ Build failed - dist directory not found!
  popd >nul 2>&1
  exit /b 1
)

echo 🚀 Deploying to S3...

REM Sync built files to S3
aws s3 sync dist/ s3://%BUCKET_NAME% --delete || (
  echo ❌ S3 sync failed!
  popd >nul 2>&1
  exit /b 1
)

REM Invalidate CloudFront cache if distribution ID is provided
if not "%CLOUDFRONT_DISTRIBUTION_ID%"=="" (
  echo 🔄 Invalidating CloudFront cache...
  aws cloudfront create-invalidation --distribution-id %CLOUDFRONT_DISTRIBUTION_ID% --paths "/*" || (
    echo ❌ CloudFront invalidation failed!
    popd >nul 2>&1
    exit /b 1
  )
)

popd >nul 2>&1
echo ✅ Deployment complete!
echo 🌐 Your app is live at: https://proovid.ai