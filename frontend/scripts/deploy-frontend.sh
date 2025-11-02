#!/bin/bash
# 🚀 Deploy Frontend to AWS S3

set -e  # Exit on any error

# Configuration
BUCKET_NAME="proovid-frontend-hosting"
CLOUDFRONT_DISTRIBUTION_ID=""  # Add your CloudFront distribution ID here if you have one

echo "🏗️  Building and deploying frontend..."

# Build the frontend
echo "📦 Building React app..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
  echo "❌ Build failed - dist directory not found!"
  exit 1
fi

echo "🚀 Deploying to S3..."

# Sync built files to S3
aws s3 sync dist/ s3://$BUCKET_NAME --delete

# Invalidate CloudFront cache if distribution ID is provided
if [ ! -z "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  echo "🔄 Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
    --paths "/*"
fi

echo "✅ Deployment complete!"
echo "🌐 Your app is live at: http://$BUCKET_NAME.s3-website-eu-central-1.amazonaws.com"