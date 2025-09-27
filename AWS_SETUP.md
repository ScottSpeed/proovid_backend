# AWS Infrastructure Setup für Proovid Vector Search & ChatBot

## 🏗️ **Benötigte AWS Services**

### 1. Amazon OpenSearch Service
```bash
# OpenSearch Domain für Vector Search erstellen
aws opensearch create-domain \
  --domain-name proovid-vector-search \
  --elasticsearch-version 7.10 \
  --cluster-config InstanceType=t3.small.search,InstanceCount=1 \
  --ebs-options EBSEnabled=true,VolumeSize=20,VolumeType=gp2 \
  --access-policies file://opensearch-access-policy.json \
  --region eu-central-1
```

### 2. IAM Rolle für ECS Task
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:eu-central-1::foundation-model/amazon.titan-embed-text-v1",
        "arn:aws:bedrock:eu-central-1::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "es:ESHttpGet",
        "es:ESHttpPost",
        "es:ESHttpPut",
        "es:ESHttpDelete"
      ],
      "Resource": "arn:aws:es:eu-central-1:*:domain/proovid-vector-search/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
        "dynamodb:Query"
      ],
      "Resource": "arn:aws:dynamodb:eu-central-1:*:table/proov_jobs"
    }
  ]
}
```

### 3. OpenSearch Access Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR-ACCOUNT-ID:role/ecsTaskRole"
      },
      "Action": "es:*",
      "Resource": "arn:aws:es:eu-central-1:YOUR-ACCOUNT-ID:domain/proovid-vector-search/*"
    }
  ]
}
```

## 🚀 **Deployment Steps**

### 1. OpenSearch Domain erstellen
```bash
# 1. OpenSearch Access Policy speichern
cat > opensearch-access-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::851725596604:role/ecsTaskRole"
      },
      "Action": "es:*",
      "Resource": "arn:aws:es:eu-central-1:851725596604:domain/proovid-vector-search/*"
    }
  ]
}
EOF

# 2. OpenSearch Domain erstellen
aws opensearch create-domain \
  --domain-name proovid-vector-search \
  --engine-version OpenSearch_1.3 \
  --cluster-config InstanceType=t3.small.search,InstanceCount=1 \
  --ebs-options EBSEnabled=true,VolumeSize=20,VolumeType=gp3 \
  --domain-endpoint-options EnforceHTTPS=true,TLSSecurityPolicy=Policy-Min-TLS-1-2-2019-07 \
  --access-policies file://opensearch-access-policy.json \
  --region eu-central-1
```

### 2. Bedrock Model Access aktivieren
```bash
# Bedrock Model Access in AWS Console aktivieren:
# 1. AWS Console → Bedrock → Model Access
# 2. Aktiviere: Amazon Titan Embeddings G1 - Text
# 3. Aktiviere: Claude 3 Sonnet
```

### 3. ECS Task Definition aktualisieren
```bash
# Environment Variables hinzufügen:
OPENSEARCH_ENDPOINT=https://search-proovid-vector-search-xxx.eu-central-1.es.amazonaws.com
USE_AWS_NATIVE_VECTOR_DB=true
AWS_DEFAULT_REGION=eu-central-1
```

### 4. IAM Role Permissions erweitern
```bash
# Bedrock und OpenSearch Permissions zur ecsTaskRole hinzufügen
aws iam attach-role-policy \
  --role-name ecsTaskRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

# Custom OpenSearch Policy erstellen und attachen
```

## 🧪 **Testing**

### 1. OpenSearch Verbindung testen
```bash
curl -X GET "https://your-opensearch-endpoint.eu-central-1.es.amazonaws.com/_cluster/health" \
  --aws-sigv4 "aws:amz:eu-central-1:es"
```

### 2. Bedrock Model testen
```python
import boto3
import json

bedrock = boto3.client('bedrock-runtime', region_name='eu-central-1')

# Titan Embeddings Test
response = bedrock.invoke_model(
    modelId='amazon.titan-embed-text-v1',
    body=json.dumps({"inputText": "Test video content"})
)
print(json.loads(response['body'].read()))

# Claude 3 Test
response = bedrock.invoke_model(
    modelId='anthropic.claude-3-sonnet-20240229-v1:0',
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 100,
        "messages": [{"role": "user", "content": "Hello, test response"}]
    })
)
print(json.loads(response['body'].read()))
```

## 💰 **Kostenoptimierung**

### OpenSearch
- **t3.small.search**: ~$35/Monat
- **10GB EBS**: ~$1/Monat
- **Total**: ~$36/Monat

### Bedrock
- **Titan Embeddings**: $0.0001 per 1K tokens
- **Claude 3 Sonnet**: $0.003 per 1K input tokens
- **Geschätzt**: $10-20/Monat bei normaler Nutzung

### Gesamt
- **Monatliche Kosten**: ~$50-60
- **Deutlich günstiger** als externe Services (Pinecone, OpenAI)

## 📊 **Monitoring**

### CloudWatch Metriken überwachen:
- OpenSearch: SearchLatency, SearchRate, IndexingErrors
- Bedrock: Invocations, ModelInvocationErrors
- DynamoDB: ConsumedReadCapacityUnits

### Logs überprüfen:
- ECS Task Logs für Vector DB Operations
- OpenSearch Domain Logs
- Bedrock Usage Logs