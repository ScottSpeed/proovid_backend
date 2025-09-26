Deploy ALB + (optional) ECS Service

This guide deploys an internet-facing ALB, target group and listeners. Optionally
it can request an ACM certificate (DNS validation via Route53) and create an
ECS Service attached to the target group.

Prerequisites
- AWS CLI configured with an account that has rights to create ALB, Route53,
  ACM and (optionally) ECS resources.
- VPC ID and two public subnet IDs where the ALB will be created.
- (Optional) Hosted Zone ID for your domain (Route53). If provided and DomainName
  set, the template will request an ACM cert and perform DNS validation using the hosted zone.

Example deploy (no ECS service):

```bash
aws cloudformation deploy \
  --template-file backend/infrastructure/cloudformation/alb-ecs-ui.yml \
  --stack-name proov-ui-alb \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    VpcId=vpc-07aaa0ed4b3295b52 \
    PublicSubnets="subnet-075be429b8d589736,subnet-0179fd692083f18ac" \
    DomainName=ui.proov.com \
    HostedZoneId=Z0123456789ABC
```

Example deploy with ECS service (supply TaskDefinitionArn and TaskSecurityGroup):

```bash
aws cloudformation deploy \
  --template-file backend/infrastructure/cloudformation/alb-ecs-ui.yml \
  --stack-name proov-ui-alb \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    VpcId=vpc-07aaa0ed4b3295b52 \
    PublicSubnets="subnet-075be429b8d589736,subnet-0179fd692083f18ac" \
    DomainName=ui.proov.com \
    HostedZoneId=Z0123456789ABC \
    ClusterName=my-cluster \
    ServiceName=frontend-service \
    TaskDefinitionArn=arn:aws:ecs:eu-central-1:851725596604:task-definition/backend-task:3 \
    TaskSecurityGroup=sg-0123456789abcdef0
```

Notes
- After deployment, if you provided DomainName and HostedZoneId, ACM will request a cert and perform DNS validation in the given Hosted Zone automatically.
- If you supply an ECS service, ensure that your task definition's container has a `containerName` of `frontend` and exposes the `FrontendContainerPort` as port mapping.
- The stack outputs `ALBDNSName` and `ALBHostedZoneId` (use these to create an alias A record if you prefer manual DNS steps).

If you want, I can deploy this stack for you (I need the VPC ID, comma-separated public subnet IDs, HostedZoneId, and whether you want the ECS service created). If yes, tell me the exact values and I will run the deploy command.
