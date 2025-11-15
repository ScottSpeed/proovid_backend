# ECS Task Definitions

Authoritative documentation for task definition files used by CI/CD.

## What Is Canonical
- The only task definition templates used by the pipeline are:
  - `ecs-taskdef-backend.json`
  - `ecs-taskdef-worker.json`
- CI/CD updates the image field and registers these automatically during deploy.
  - See `buildspec.yml` post_build phase:
    - Backend: copies `backend/infrastructure/ecs-taskdef-backend.json` to `/tmp`, injects the built image via `jq`, registers the task definition, then forces a new deployment for service `backend-service`.
    - Worker: copies `backend/infrastructure/ecs-taskdef-worker.json` to `/tmp`, injects the built image via `jq`, registers the task definition, then forces a new deployment for service `worker-service`.
- Older `*task-def*.json` files outside this folder are deprecated and have been removed. Keep task-defs centralized here only.

## How Updates Flow
- Edit `ecs-taskdef-backend.json` or `ecs-taskdef-worker.json` for resource settings, env vars, secrets, logging, etc.
- Do not hardcode image tags here. The pipeline injects the correct ECR image during deployment using `jq`.
- After merge, CodeBuild will:
  1) build and push images to ECR
  2) inject the image into these JSONs
  3) register the new task definition
  4) force a new ECS service deployment

## Manual Update (optional)
If you need to manually register a task definition and roll the service (use the right names for your environment):

```bash
# Backend
cp backend/infrastructure/ecs-taskdef-backend.json /tmp/taskdef-backend.json
jq --arg img "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/backend:$IMAGE_TAG" \
  '.containerDefinitions[0].image = $img' \
  /tmp/taskdef-backend.json > /tmp/taskdef-backend-2.json
aws ecs register-task-definition --cli-input-json file:///tmp/taskdef-backend-2.json
aws ecs update-service --cluster my-cluster --service backend-service --force-new-deployment

# Worker
cp backend/infrastructure/ecs-taskdef-worker.json /tmp/taskdef-worker.json
jq --arg img "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/worker:$IMAGE_TAG" \
  '.containerDefinitions[0].image = $img' \
  /tmp/taskdef-worker.json > /tmp/taskdef-worker-2.json
aws ecs register-task-definition --cli-input-json file:///tmp/taskdef-worker-2.json
aws ecs update-service --cluster my-cluster --service worker-service --force-new-deployment
```

## Rollback
To roll back to a previous image:
- Pick an older ECR tag (for `backend` or `worker`).
- Re-run the manual update section, replacing `$IMAGE_TAG` with the desired tag.

## Tips
- Validate JSON before registering: `jq empty ecs-taskdef-backend.json`
- Ensure `taskRoleArn`, `executionRoleArn`, log configuration, CPU/MEM, and env vars are correct for your account/region.
- CloudWatch log groups are defined inside the task-defs (for example `/ecs/backend` and `/ecs/worker` if configured that way).
- Keep all task-def variants in this folder. If you need experimental variants, prefix them clearly and avoid scattering copies elsewhere.
