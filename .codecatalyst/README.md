# CodeCatalyst CI/CD Pipeline Setup

Diese Pipeline automatisiert das Deployment des Backends zu AWS ECS.

## Setup in CodeCatalyst

### 1. Environment erstellen
1. Gehe zu deinem CodeCatalyst Space
2. Navigiere zu **Settings** → **Environments**  
3. Klicke **Create environment**
4. Name: `backend-build-env`
5. **AWS account connection** hinzufügen:
   - Account ID: `851725596604`
   - Region: `eu-central-1`

### 2. IAM Role in AWS erstellen
Die Pipeline benötigt eine IAM Role mit folgenden Permissions:

```bash
# Role Name: CodeCatalystWorkflowDevelopmentRole-proov-backend
# Trust Policy: CodeCatalyst Service
```

**Benötigte Policies:**
- `AmazonEC2ContainerRegistryPowerUser` (für ECR push/pull)
- `AmazonECS_FullAccess` (für ECS deployments)
- Custom Policy für Task Definition Management:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecs:RegisterTaskDefinition",
                "ecs:DescribeServices",
                "ecs:DescribeTaskDefinition",
                "ecs:UpdateService",
                "ecs:DescribeTasks",
                "ecs:ListTasks"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iam:PassRole"
            ],
            "Resource": [
                "arn:aws:iam::851725596604:role/ecsTaskExecutionRole",
                "arn:aws:iam::851725596604:role/ecsTaskRole"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "*"
        }
    ]
}
```

### 3. Pipeline-Trigger

Die Pipeline triggert automatisch bei:
- **Push auf `main` branch**
- **Änderungen in `backend/` oder `.codecatalyst/`**

### 4. Pipeline-Ablauf

1. **Build**: Docker Image aus `backend/` erstellen
2. **Push**: Image zu ECR pushen mit timestamp-tag
3. **Deploy**: Neue ECS Task Definition registrieren
4. **Update**: ECS Service mit neuer Task Definition aktualisieren
5. **Verify**: Warten bis deployment stabil ist und Health-Check

### 5. Monitoring

- **CloudWatch Logs**: `/ecs/backend` log group
- **ECS Console**: Service Status in `my-cluster`
- **API Health**: https://api.proovid.de/health

### 6. Rollback bei Problemen

Falls ein Deployment fehlschlägt:

```bash
# Zurück zur vorherigen Task Definition
aws ecs update-service \
  --cluster my-cluster \
  --service backend-service-new \
  --task-definition backend-task:44  # Vorherige Version
```

## Local Testing

Vor dem Push kannst du lokal testen:

```bash
# Backend Docker Image bauen
cd backend
docker build -t backend-test .

# Image lokal testen
docker run -p 8000:8000 -e AWS_DEFAULT_REGION=eu-central-1 backend-test

# Health Check
curl http://localhost:8000/health
```

## Vorteile dieser Pipeline

✅ **Automatisches Deployment** bei Code-Änderungen  
✅ **Zero-Downtime** durch Rolling Updates  
✅ **Automatische Health Checks**  
✅ **Fail-Safe**: Deployment stoppt bei Fehlern  
✅ **Traceability**: Jedes Image hat eindeutigen Tag  
✅ **Nur Backend-Trigger**: Frontend-Änderungen lösen keine Backend-Pipeline aus
