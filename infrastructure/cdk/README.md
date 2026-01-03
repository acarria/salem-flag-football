# Salem Flag Football - AWS CDK Infrastructure

This directory contains the AWS CDK infrastructure code for deploying the Salem Flag Football League platform to AWS.

## Architecture Overview

The infrastructure is organized into multiple stacks:

1. **VPC Stack** - Networking foundation with public/private/isolated subnets
2. **Database Stack** - RDS PostgreSQL in isolated subnets with encryption
3. **Backend Stack** - ECS Fargate service with Application Load Balancer
4. **Frontend Stack** - S3 bucket with CloudFront distribution

## Security Features

### Network Security
- ✅ VPC with isolated subnets for database (no internet access)
- ✅ Private subnets for backend ECS tasks
- ✅ Security groups with least privilege access
- ✅ No public database access

### Data Security
- ✅ RDS encryption at rest
- ✅ Secrets Manager for database credentials
- ✅ S3 bucket encryption
- ✅ CloudFront with HTTPS only

### Access Control
- ✅ IAM roles with minimal permissions
- ✅ Task execution role can only read secrets
- ✅ No public S3 bucket access (CloudFront OAI only)

### Monitoring & Logging
- ✅ CloudWatch Container Insights
- ✅ CloudWatch Logs for ECS tasks
- ✅ CloudFront access logs
- ✅ Performance Insights for RDS (prod)

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js** 18+ and npm
3. **AWS CDK CLI** installed globally:
   ```bash
   npm install -g aws-cdk
   ```
4. **Docker** (for building container images)
5. **Bootstrap CDK** in your AWS account:
   ```bash
   cdk bootstrap aws://ACCOUNT-NUMBER/REGION
   ```

## Setup

1. **Install dependencies:**
   ```bash
   cd infrastructure/cdk
   npm install
   ```

2. **Build the TypeScript:**
   ```bash
   npm run build
   ```

3. **Synthesize CloudFormation templates:**
   ```bash
   npm run synth
   ```

## Deployment

### Development Environment
```bash
npm run deploy:dev
```

### Production Environment
```bash
npm run deploy:prod
```

### Manual Deployment
```bash
# Deploy all stacks
cdk deploy --all

# Deploy specific stack
cdk deploy salem-flag-football-vpc-dev
```

## Environment Configuration

Set environment variables or use CDK context:

```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1
```

Or use context in `cdk.json` or command line:
```bash
cdk deploy --context environment=prod
```

## Stack Details

### VPC Stack
- **Resources:**
  - VPC with 2 availability zones
  - Public subnets (for NAT Gateway and ALB)
  - Private subnets (for ECS tasks)
  - Isolated subnets (for RDS)
  - Security groups with least privilege

### Database Stack
- **Resources:**
  - RDS PostgreSQL 15.4
  - Secrets Manager for credentials
  - Multi-AZ in production
  - Automated backups
  - Encryption at rest

### Backend Stack
- **Resources:**
  - ECS Fargate cluster
  - Application Load Balancer (HTTPS)
  - Auto-scaling (CPU and memory)
  - CloudWatch logging
  - Container Insights

### Frontend Stack
- **Resources:**
  - S3 bucket for static assets
  - CloudFront distribution
  - Security headers (HSTS, XSS protection, etc.)
  - HTTPS only

## Cost Estimation

### Development Environment
- ECS Fargate: ~$15/month (0.25 vCPU, 0.5GB RAM)
- RDS (db.t3.micro): ~$15/month
- ALB: ~$16/month
- CloudFront: ~$1/month (low traffic)
- S3: ~$0.50/month
- **Total: ~$47-50/month**

### Production Environment
- ECS Fargate: ~$30-50/month (depending on traffic)
- RDS (db.t3.small, Multi-AZ): ~$60/month
- ALB: ~$16/month
- CloudFront: ~$5-10/month
- S3: ~$1/month
- **Total: ~$112-137/month**

## Post-Deployment Steps

1. **Get database credentials:**
   ```bash
   aws secretsmanager get-secret-value \
     --secret-id salem-flag-football-db-credentials-dev \
     --query SecretString --output text | jq .
   ```

2. **Update environment variables** in your deployment pipeline or ECS task definition

3. **Configure DNS** to point to CloudFront distribution (optional)

4. **Set up SSL certificate** for custom domain (if needed):
   - Request ACM certificate
   - Update ALB and CloudFront to use certificate

## Useful Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and compile
- `npm run cdk` - Show CDK CLI help
- `npm run deploy` - Deploy all stacks
- `npm run diff` - Compare deployed stack with current state
- `npm run synth` - Synthesize CloudFormation templates
- `npm run destroy` - Destroy all stacks

## Troubleshooting

### CDK Bootstrap Required
If you see "CDK toolkit stack not found", run:
```bash
cdk bootstrap aws://ACCOUNT-NUMBER/REGION
```

### Docker Build Issues
Ensure Docker is running and you have permissions:
```bash
docker ps
```

### Permission Errors
Ensure your AWS credentials have appropriate permissions:
- CloudFormation
- IAM
- EC2/VPC
- ECS
- RDS
- S3
- CloudFront
- Secrets Manager

## Security Best Practices

1. ✅ Database in isolated subnets (no internet)
2. ✅ Secrets in Secrets Manager (not environment variables)
3. ✅ Encryption at rest for RDS and S3
4. ✅ HTTPS only for CloudFront and ALB
5. ✅ Security groups with least privilege
6. ✅ IAM roles with minimal permissions
7. ✅ CloudWatch logging enabled
8. ✅ Multi-AZ for production

## Next Steps

- [ ] Add WAF for CloudFront
- [ ] Set up Route53 for custom domain
- [ ] Configure ACM certificates
- [ ] Set up CI/CD pipeline
- [ ] Add monitoring and alerting
- [ ] Configure backup retention policies
- [ ] Set up disaster recovery

