# 🚀 AWS S3 + CloudFront Frontend Deployment

## 1. AWS S3 Bucket Setup
```bash
# Create S3 bucket for frontend hosting
aws s3 mb s3://proovid-frontend-hosting --region eu-central-1

# Enable static website hosting
aws s3 website s3://proovid-frontend-hosting \
  --index-document index.html \
  --error-document index.html
```

## 2. Build & Deploy Script
```bash
# Build the frontend
npm run build

# Sync to S3
aws s3 sync dist/ s3://proovid-frontend-hosting --delete

# Invalidate CloudFront cache (after CloudFront setup)
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## 3. CloudFront Distribution
Create CloudFront distribution for:
- Fast global content delivery
- HTTPS/SSL certificates
- Custom domain support
- Caching optimization

## 4. Deployment Pipeline Options

### Option A: GitHub Actions
```yaml
name: Deploy Frontend
on:
  push:
    branches: [ master ]
    paths: [ 'frontend/**' ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd frontend
          npm install
          
      - name: Build
        run: |
          cd frontend
          npm run build
          
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-central-1
          
      - name: Deploy to S3
        run: |
          aws s3 sync frontend/dist/ s3://proovid-frontend-hosting --delete
          
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### Option B: AWS CodeBuild
```yaml
version: 0.2
phases:
  install:
    runtime-versions:
      nodejs: 18
  pre_build:
    commands:
      - cd frontend
      - npm install
  build:
    commands:
      - npm run build
  post_build:
    commands:
      - aws s3 sync dist/ s3://proovid-frontend-hosting --delete
      - aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"
artifacts:
  files:
    - frontend/dist/**/*
```

## 5. Environment Configuration

Update `frontend/src/services/auth.ts`:
```typescript
const API_BASE_URL = import.meta.env.PROD
  ? 'https://your-actual-backend-api.com/api'  // Production backend
  : 'http://localhost:8000/api';               // Local development
```

## 6. Quick Deploy Commands
```bash
# One-time setup (run once)
./scripts/setup-aws-hosting.sh

# Deploy updates (run after changes)
./scripts/deploy-frontend.sh
```