# Infrastructure

This directory contains the AWS SAM (Serverless Application Model) template for deploying the Salem Flag Football League platform on AWS Lambda.

## Directory Structure

```
apps/infra/
├── sam/
│   └── template.yaml   # SAM template: Lambda + API Gateway HTTP API
├── package.json        # Turborepo workspace (wraps SAM CLI commands)
└── README.md           # This file
```

## Architecture

- **API Gateway HTTP API** — routes all requests to the Lambda function
- **Lambda Function** — runs the FastAPI app via Mangum (`app.main.handler`)
- **RDS (PostgreSQL)** — accessed via RDS Proxy in production; `NullPool` is used for Lambda-safe connection management
- **EventBridge Scheduler** — triggers deadline handler Lambda at registration close time
- **SSM Parameter Store** — all secrets/config are resolved at deploy time via `{{resolve:ssm:...}}`

## Quick Start

1. **Install SAM CLI**: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

2. **Build the Docker image**:
   ```bash
   cd apps/infra/sam
   sam build
   ```
   Or from the repo root:
   ```bash
   turbo build --filter=@salem/infra
   ```

3. **Deploy** (guided first time):
   ```bash
   cd apps/infra/sam
   sam deploy --guided
   ```
   Pass `--parameter-overrides AllowedOrigin=https://your-app.com` in production to restrict CORS.

4. **Subsequent deploys**:
   ```bash
   cd apps/infra/sam
   sam deploy
   ```

## Environment / SSM Parameters

Store these in SSM Parameter Store before deploying:

| SSM Path | Description |
|---|---|
| `/flagfootball/DATABASE_URL` | PostgreSQL connection string (via RDS Proxy) |
| `/flagfootball/CLERK_JWKS_URL` | Clerk JWKS endpoint |
| `/flagfootball/CLERK_ISSUER` | Clerk issuer URL |
| `/flagfootball/CLERK_SECRET_KEY` | Clerk secret key |
| `/flagfootball/RESEND_API_KEY` | Resend email API key |
| `/flagfootball/APP_URL` | Frontend URL (used in invitation emails) |
| `/flagfootball/CORS_ORIGINS` | Allowed CORS origins |
| `/flagfootball/ADMIN_EMAIL` | Admin contact email |

## CORS

The `AllowedOrigin` parameter **must** be set to the exact frontend origin in production. The template default (`REPLACE_WITH_PROD_ORIGIN`) is intentionally invalid so a misconfigured deploy fails loudly rather than silently permitting `*` with credentials.

```bash
sam deploy --parameter-overrides AllowedOrigin=https://your-app.com
```

## Security

- Secrets stored in SSM Parameter Store; never committed to the template
- `FlagFootballFunction` — Lambda execution role should follow least-privilege IAM
- `DeadlineFunction` — no API Gateway event source; only `SchedulerExecutionRole` (scoped `lambda:InvokeFunction`) can invoke it. The handler also validates `event["source"] == "aws.scheduler"` as a defence-in-depth check
- RDS Proxy handles connection pooling and IAM auth to the database
- All HTTP responses include security headers (HSTS, CSP, X-Content-Type-Options, etc.) set by `SecurityHeadersMiddleware` in `main.py`
