#!/usr/bin/env bash
set -euo pipefail

# attach-iam-ssm-policy.sh
# Create a managed IAM policy from iam-policy-ssm-read.json (if not exists)
# and attach it to the specified IAM Role (role name or ARN).
# Usage:
#   ./attach-iam-ssm-policy.sh --role ROLE_NAME_OR_ARN [--policy-name NAME]
# Example:
#   ./attach-iam-ssm-policy.sh --role ecsTaskRole
#   ./attach-iam-ssm-policy.sh --role arn:aws:iam::123456789012:role/ecsTaskRole --policy-name my-proov-ssm

POLICY_FILE="$(dirname "$0")/iam-policy-ssm-read.json"
POLICY_NAME_DEFAULT="proov-ssm-read"

ROLE=""
POLICY_NAME="${POLICY_NAME_DEFAULT}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --role)
      ROLE="$2"; shift 2;;
    --policy-name)
      POLICY_NAME="$2"; shift 2;;
    -h|--help)
      echo "Usage: $0 --role ROLE_NAME_OR_ARN [--policy-name NAME]"; exit 0;;
    *)
      echo "Unknown arg: $1"; exit 1;;
  esac
done

if [ -z "$ROLE" ]; then
  echo "Error: --role is required"
  exit 2
fi

if [ ! -f "$POLICY_FILE" ]; then
  echo "Policy file not found: $POLICY_FILE"
  exit 3
fi

# If role is an ARN, extract the role name
if [[ "$ROLE" =~ ^arn:aws:iam::[0-9]+:role/.+ ]]; then
  ROLE_NAME="${ROLE##*/}"
else
  ROLE_NAME="$ROLE"
fi

echo "Using role: $ROLE_NAME"

# Check if a local managed policy with the desired name already exists
EXISTING_ARN=$(aws iam list-policies --scope Local --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn | [0]" --output text 2>/dev/null || echo "None")

if [ "$EXISTING_ARN" = "None" ] || [ -z "$EXISTING_ARN" ] || [ "$EXISTING_ARN" = "null" ]; then
  echo "Policy ${POLICY_NAME} not found, creating..."
  CREATE_OUT=$(aws iam create-policy --policy-name "$POLICY_NAME" --policy-document file://"$POLICY_FILE" 2>&1) || { echo "Failed to create policy: $CREATE_OUT"; exit 4; }
  EXISTING_ARN=$(echo "$CREATE_OUT" | awk '/PolicyArn/ {print $2}' | tr -d '",')
  # Fallback: query again
  if [ -z "$EXISTING_ARN" ] || [ "$EXISTING_ARN" = "null" ]; then
    EXISTING_ARN=$(aws iam list-policies --scope Local --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn | [0]" --output text)
  fi
  echo "Created policy: $EXISTING_ARN"
else
  echo "Found existing policy: $EXISTING_ARN"
fi

# Check if the role already has the policy attached
ATTACHED=$(aws iam list-attached-role-policies --role-name "$ROLE_NAME" --query "AttachedPolicies[?PolicyArn=='${EXISTING_ARN}']|[0]" --output text 2>/dev/null || echo "")
if [ -n "$ATTACHED" ] && [ "$ATTACHED" != "None" ]; then
  echo "Policy already attached to role $ROLE_NAME"
  exit 0
fi

# Attach the policy
echo "Attaching policy $EXISTING_ARN to role $ROLE_NAME"
aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$EXISTING_ARN"

echo "Done."
