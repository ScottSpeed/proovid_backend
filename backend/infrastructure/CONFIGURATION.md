Configuration and deployment notes

This project supports reading configuration from a JSON file or from environment variables.

Priority order for configuration:

1. JSON config file pointed to by environment variable `CONFIG_FILE`
2. `/etc/proov/config.json`
3. `backend/config.json` (repo-local example)
4. Environment variables

Recommended keys (in `backend/config.json` or `/etc/proov/config.json`):

- AWS_DEFAULT_REGION: eu-central-1
- OPENSEARCH_HOST: <your-aoss-host>.eu-central-1.aoss.amazonaws.com
- OPENSEARCH_INDEX: video-vector-collection
- AWS_S3_BUCKET: your-s3-bucket-name
- OPENSEARCH_SKIP_INDEX: "0" or "1" (string)
- DOCKER_NETWORK: my_agent_default

Deployment helpers

- `create-ecr-and-update-taskdefs.sh` now supports two optional flags via env:
  - UPLOAD_SSM=1 : read `backend/config.json` and upload it to SSM Parameter Store at `/proov/backend/config` (or path set by SSM_PARAM). The upload uses SecureString.
  - TASK_SECRETS=1 : when registering task definitions, the script will add a `secrets` entry mapping `PROOV_CONFIG_SSM` to the SSM parameter. The container can then read the SSM parameter at runtime using the SDK.

Example usage:

```bash
# push images and register task defs (normal)
./create-ecr-and-update-taskdefs.sh

# push images, upload config to SSM, and register taskdefs with secret reference
UPLOAD_SSM=1 TASK_SECRETS=1 ./create-ecr-and-update-taskdefs.sh
```

- `install-config.sh` installs a local config file to `/etc/proov/config.json` (requires sudo). Use this for simple deployments where you don't want SSM.

Security notes

- Do NOT commit secrets to Git. Use SSM Parameter Store (SecureString) or Secrets Manager for production secrets.
- When using `TASK_SECRETS=1`, the task definition will include a secrets reference and the task IAM role must be allowed to read the SSM parameter.

Next steps

- If you want, I can update taskdef JSON templates to include an explicit `secrets` mapping for specific environment keys (OPENSEARCH_HOST, AWS creds via IAM role are preferred, etc.) instead of the single `PROOV_CONFIG_SSM` key.

Per-key SSM parameter mapping

The deployment script can now create per-key SSM parameters (recommended) for the keys used by the backend and worker: e.g.

  /proov/backend/OPENSEARCH_HOST
  /proov/backend/OPENSEARCH_INDEX
  /proov/worker/OPENSEARCH_HOST
  /proov/worker/OPENSEARCH_INDEX

These parameters are created when running the script with UPLOAD_SSM=1 and TASK_SECRETS=1. The task definitions in `ecs-taskdef-*.json` already reference these names in their `secrets` arrays. Ensure the ECS task role has permission to read these SSM parameters (see `iam-policy-ssm-read.json` example).

IAM policy

An example IAM policy that allows reading only the above SSM parameters is provided at `iam-policy-ssm-read.json`. Attach a least-privilege policy like this to your ECS task role so containers can fetch their secrets at runtime.
