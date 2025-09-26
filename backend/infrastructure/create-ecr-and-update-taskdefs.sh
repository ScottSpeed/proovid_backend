
#!/usr/bin/env bash
set -euo pipefail

# --- Tool-Prüfung: jq, docker, aws, git ---
for tool in jq docker aws git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: Benötigtes Tool '$tool' ist nicht installiert oder nicht im PATH. Bitte installiere es und versuche es erneut." >&2
    exit 2
  fi
done

# ...existing code...
AWS_REGION="${AWS_REGION:-eu-central-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
ECR_BASE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Adjust these to your ECS setup
ECS_CLUSTER="${ECS_CLUSTER:-my-cluster}"
ECS_SERVICE_BACKEND="${ECS_SERVICE_BACKEND:-backend-service}"
ECS_SERVICE_WORKER="${ECS_SERVICE_WORKER:-worker-service}"

# Determine repo root relative to this script so builds work regardless of CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Repos / folders (use repo-root absolute paths)
FRONTEND_DIR="${FRONTEND_DIR:-$REPO_ROOT/frontend}"
BACKEND_DIR="${BACKEND_DIR:-$REPO_ROOT/backend}"
WORKER_DIR="${WORKER_DIR:-$REPO_ROOT/backend/worker}"

REPOS=(frontend backend worker)

# Use git short hash as image tag
IMAGE_TAG="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || date +%s)"
echo "Using image tag: $IMAGE_TAG"

# login to ECR
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${ECR_BASE}"

# build, tag, push helper with Dockerfile existence check

push_image() {
  local name=$1
  local dir=$2
  local dockerfile="${3:-$dir/Dockerfile}"

  echo "Build $name from $dir (dockerfile: $dockerfile)"
  if [ ! -d "$dir" ]; then
    echo "ERROR: build context directory not found: $dir"
    exit 1
  fi
  if [ ! -f "$dockerfile" ]; then
    echo "ERROR: Dockerfile not found at $dockerfile"
    echo "If your Dockerfile has a different name or location, pass it as 3rd arg."
    exit 1
  fi

  # Optional: Baue Images nur, wenn sich der Code geändert hat (Build-Cache nutzen)
  # Prüfe, ob das Image mit gleichem Tag schon existiert (lokal oder remote)
  if docker manifest inspect "${ECR_BASE}/${name}:${IMAGE_TAG}" >/dev/null 2>&1; then
    echo "Image ${ECR_BASE}/${name}:${IMAGE_TAG} existiert bereits (remote). Überspringe Build & Push."
    return 0
  fi

  docker build --pull -t "${name}:local" -f "$dockerfile" "$dir"
  docker tag "${name}:local" "${ECR_BASE}/${name}:${IMAGE_TAG}"
  docker push "${ECR_BASE}/${name}:${IMAGE_TAG}"
  echo "Pushed ${ECR_BASE}/${name}:${IMAGE_TAG}"
}

# Build & push images (adjust dockerfile path if needed)
push_image frontend "$FRONTEND_DIR" "$FRONTEND_DIR/Dockerfile"
push_image backend  "$BACKEND_DIR"  "$BACKEND_DIR/Dockerfile"
# Build the worker image using the backend directory as the build context so
# shared modules like agent.py and video_analyzer.py (located in backend/) are
# available inside the image. The Dockerfile remains at backend/worker/Dockerfile
# so we pass that as -f.
push_image worker   "$BACKEND_DIR"   "$WORKER_DIR/Dockerfile"

# Optional: upload config.json to SSM Parameter Store (secure, optional)
# If UPLOAD_SSM=1, the script will read backend/config.json and create/update
# a secure string parameter at /proov/backend/config (or the path in SSM_PARAM)
if [ "${UPLOAD_SSM:-0}" = "1" ]; then
  SSM_PARAM="${SSM_PARAM:-/proov/backend/config}"
  CFG_FILE="$BACKEND_DIR/config.json"
  if [ ! -f "$CFG_FILE" ]; then
    echo "UPLOAD_SSM requested but $CFG_FILE not found"
    exit 1
  fi
  echo "Uploading $CFG_FILE to SSM Parameter Store at $SSM_PARAM (SecureString)"
  aws ssm put-parameter --name "$SSM_PARAM" --value "$(cat $CFG_FILE | jq -c .)" --type SecureString --overwrite --region "$AWS_REGION"
  echo "Uploaded config to SSM: $SSM_PARAM"
fi

# Update taskdef JSONs: set containerDefinitions[0].image to new image tag and register
register_taskdef() {
  local taskfile="$1"   # existing template file
  echo "Registering taskdef from $taskfile"
  tmp="/tmp/$(basename $taskfile).$$.json"
  cp "$taskfile" "$tmp"

  # replace first containerDefinitions[0].image with ECR URI based on container name
  repo="$(jq -r .containerDefinitions[0].name "$tmp")"
  # fallback to taskfile basename if container name empty
  if [ -z "$repo" ] || [ "$repo" = "null" ]; then
    repo="$(basename "$taskfile" | sed 's/ecs-taskdef-//; s/.json//g' | cut -d'-' -f1)"
  fi
  ecrimg="${ECR_BASE}/${repo}:${IMAGE_TAG}"
  jq --arg img "$ecrimg" '.containerDefinitions[0].image = $img' "$tmp" > "${tmp}2" && mv "${tmp}2" "$tmp"

  # (Entfernt: OPENSEARCH SSM-Parameter und Secrets-Logik)

  aws ecs register-task-definition --cli-input-json "file://$tmp"
  rm -f "$tmp"
  echo "Registered taskdef from $taskfile -> image $ecrimg"
}

# Optionally attach DynamoDB policy to the task role before registering worker taskdef
# Set ATTACH_DDB_POLICY=1 and ATTACH_DDB_ROLE=<role-name-or-arn> to enable
if [ "${ATTACH_DDB_POLICY:-0}" = "1" ]; then
  ATTACH_ROLE="${ATTACH_DDB_ROLE:-ecsTaskRole}"
  echo "ATTACH_DDB_POLICY is set; attaching DynamoDB policy to role $ATTACH_ROLE"
  "$SCRIPT_DIR/attach-iam-ddb-policy.sh" --role "$ATTACH_ROLE" || echo "attach-iam-ddb-policy.sh failed (continuing)"
fi

if [ "${ATTACH_SQS_POLICY:-0}" = "1" ]; then
  ATTACH_ROLE="${ATTACH_SQS_ROLE:-ecsTaskRole}"
  echo "ATTACH_SQS_POLICY is set; attaching SQS policy to role $ATTACH_ROLE"
  "$SCRIPT_DIR/attach-iam-sqs-worker-policy.sh" --role "$ATTACH_ROLE" || echo "attach-iam-sqs-worker-policy.sh failed (continuing)"
fi

register_taskdef "$SCRIPT_DIR/ecs-taskdef-backend.json"
register_taskdef "$SCRIPT_DIR/ecs-taskdef-worker.json"

# Force new deployment for services
echo "Updating ECS services to force new deployment..."
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE_BACKEND" --force-new-deployment || true
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE_WORKER" --force-new-deployment || true

echo "Done. Check ECS console or run:"
echo " aws ecs describe-services --cluster $ECS_CLUSTER --services $ECS_SERVICE_BACKEND $ECS_SERVICE_WORKER --region $AWS_REGION"
echo "View logs: CloudWatch Logs groups configured in taskdefs (e.g. /ecs/backend /ecs/worker)."

# --- Rollback-Hinweis ---
echo "\\nRollback auf vorheriges Image-Tag:"
echo "1. Finde das gewünschte alte Tag (z.B. mit: aws ecr list-images --repository-name backend --region $AWS_REGION)"
echo "2. Editiere die Task-Definition (z.B. $SCRIPT_DIR/ecs-taskdef-backend.json) und setze das Feld 'image' auf das alte Tag."
echo "3. Registriere die Task-Definition erneut und führe ein 'aws ecs update-service --force-new-deployment' aus."
echo "Beispiel:"
echo "  jq '.containerDefinitions[0].image = \"$ECR_BASE/backend:<ALT_TAG>\"' $SCRIPT_DIR/ecs-taskdef-backend.json > /tmp/rollback-taskdef.json"
echo "  aws ecs register-task-definition --cli-input-json file:///tmp/rollback-taskdef.json"
echo "  aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE_BACKEND --force-new-deployment"