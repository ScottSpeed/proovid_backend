#!/bin/bash
# Deploy Lambda Backend Script

echo "📦 Creating Lambda deployment package..."

# Create deployment directory
rm -rf deployment
mkdir deployment

# Copy Lambda function
cp lambda_function.py deployment/

# Install dependencies
pip install -r requirements.txt -t deployment/

# Create ZIP package
cd deployment
zip -r ../lambda_backend.zip .
cd ..

echo "🚀 Deploying Lambda function..."

# Create or update Lambda function
aws lambda create-function \
    --function-name proov-backend-lambda \
    --runtime python3.12 \
    --role arn:aws:iam::851725596604:role/lambda-execution-role \
    --handler lambda_function.lambda_handler \
    --zip-file fileb://lambda_backend.zip \
    --timeout 30 \
    --memory-size 512 \
    --environment Variables='{AWS_DEFAULT_REGION=eu-central-1}' \
    2>/dev/null || \
aws lambda update-function-code \
    --function-name proov-backend-lambda \
    --zip-file fileb://lambda_backend.zip

echo "🌐 Creating API Gateway..."

# Create API Gateway (if it doesn't exist)
aws apigateway create-rest-api \
    --name proov-backend-api \
    --description "Proov Backend API via Lambda" \
    2>/dev/null || echo "API Gateway might already exist"

echo "✅ Lambda backend deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure API Gateway routes"
echo "2. Update frontend API endpoint"
echo "3. Test the new Lambda backend"
