#!/bin/bash
set -e

echo "🚀 Frontend-Deployment für proovid.de"

# Konfiguration
BUCKET_NAME="frontend-deploy-1756677679"
DISTRIBUTION_ID="EP5ICKB8WIM46"
BUILD_DIR="frontend/dist"

# 1. Frontend bauen
echo "📦 Frontend wird gebaut..."
cd frontend
npm run build
cd ..

# 2. Zu S3 hochladen
echo "☁️ Upload zu S3 Bucket: $BUCKET_NAME"
aws s3 sync $BUILD_DIR s3://$BUCKET_NAME --delete --cache-control "max-age=31536000"

# HTML-Dateien mit kürzerem Cache (für Updates)
aws s3 cp $BUILD_DIR/index.html s3://$BUCKET_NAME/index.html --cache-control "max-age=300"

# 3. CloudFront Cache invalidieren
echo "🔄 CloudFront Cache wird invalidiert..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

echo "✅ Frontend-Deployment abgeschlossen!"
echo "🌐 Verfügbar unter: https://ui.proovid.de"