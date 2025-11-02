#!/bin/bash
# 🚀 Setup AWS S3 + CloudFront for Frontend Hosting

set -e  # Exit on any error

echo "🏗️  Setting up AWS Frontend Hosting..."

# Configuration
BUCKET_NAME="proovid-frontend-hosting"
REGION="eu-central-1"

echo "📦 Creating S3 bucket: $BUCKET_NAME"

# Create S3 bucket
aws s3 mb s3://$BUCKET_NAME --region $REGION || echo "Bucket might already exist"

# Configure bucket for static website hosting
aws s3 website s3://$BUCKET_NAME \
  --index-document index.html \
  --error-document index.html

# Set bucket policy for public read access
cat > bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy --bucket $BUCKET_NAME --policy file://bucket-policy.json
rm bucket-policy.json

echo "✅ S3 bucket setup complete!"
echo "📝 Next steps:"
echo "   1. Create CloudFront distribution (optional)"
echo "   2. Run ./deploy-frontend.sh to deploy your app"
echo "   3. Access via: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"