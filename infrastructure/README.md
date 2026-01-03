# Infrastructure as Code

This directory contains the infrastructure code for deploying the Salem Flag Football League platform.

## Directory Structure

```
infrastructure/
├── cdk/                    # AWS CDK project
│   ├── bin/                # CDK app entry point
│   ├── lib/                # Stack definitions
│   │   └── stacks/         # Individual stack files
│   ├── package.json        # CDK dependencies
│   └── README.md           # CDK-specific documentation
└── README.md               # This file
```

## Quick Start

1. **Navigate to CDK directory:**
   ```bash
   cd infrastructure/cdk
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Bootstrap CDK (first time only):**
   ```bash
   cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-1
   ```

4. **Deploy infrastructure:**
   ```bash
   npm run deploy:dev
   ```

See `cdk/README.md` for detailed documentation.

## Stacks

- **VPC Stack**: Networking foundation
- **Database Stack**: RDS PostgreSQL
- **Backend Stack**: ECS Fargate service
- **Frontend Stack**: S3 + CloudFront

## Security

All stacks follow AWS security best practices:
- Encryption at rest
- Least privilege IAM roles
- Isolated network subnets
- Secrets Manager for credentials
- HTTPS only

