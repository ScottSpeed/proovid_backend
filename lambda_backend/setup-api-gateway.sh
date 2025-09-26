#!/bin/bash

# API Gateway Setup Script for Proov Backend Lambda

API_ID="hgq87idipg"
ROOT_RESOURCE_ID="jf599culq4"
REGION="eu-central-1"
LAMBDA_FUNCTION_ARN="arn:aws:lambda:eu-central-1:851725596604:function:proov-backend-lambda"

echo "🔧 Setting up API Gateway routes for Lambda backend..."

# Create proxy resource
echo "📋 Creating proxy resource..."
PROXY_RESOURCE=$(aws apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $ROOT_RESOURCE_ID \
    --path-part "{proxy+}" \
    --region $REGION)

PROXY_RESOURCE_ID=$(echo $PROXY_RESOURCE | jq -r '.id')
echo "✅ Proxy resource created: $PROXY_RESOURCE_ID"

# Create ANY method for proxy
echo "📋 Creating ANY method for proxy..."
aws apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --authorization-type NONE \
    --region $REGION

# Set up integration with Lambda
echo "📋 Setting up Lambda integration..."
aws apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RESOURCE_ID \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_FUNCTION_ARN/invocations" \
    --region $REGION

# Give API Gateway permission to invoke Lambda
echo "📋 Adding Lambda permission for API Gateway..."
aws lambda add-permission \
    --function-name proov-backend-lambda \
    --statement-id api-gateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:851725596604:$API_ID/*/*" \
    --region $REGION

# Create deployment
echo "📋 Creating API deployment..."
DEPLOYMENT=$(aws apigateway create-deployment \
    --rest-api-id $API_ID \
    --stage-name prod \
    --region $REGION)

echo "✅ API Gateway setup complete!"
echo "🌐 API Endpoint: https://$API_ID.execute-api.$REGION.amazonaws.com/prod"
echo ""
echo "📋 Available endpoints:"
echo "  POST /login - User authentication"
echo "  GET /jobs - List all jobs"
echo "  DELETE /jobs/{id} - Delete job"
echo "  POST /jobs/{id}/restart - Restart job"
echo "  POST /jobs/test - Create test job"
echo "  GET /health - Health check"
