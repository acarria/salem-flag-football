#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/stacks/vpc-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { BackendStack } from '../lib/stacks/backend-stack';
import { FrontendStack } from '../lib/stacks/frontend-stack';

const app = new cdk.App();

// Get environment from context or default to dev
const environment = app.node.tryGetContext('environment') || 'dev';
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION || 'us-east-1';

// Base name for all resources
const projectName = 'salem-flag-football';

// VPC Stack - Foundation networking
const vpcStack = new VpcStack(app, `${projectName}-vpc-${environment}`, {
  env: { account, region },
  environment,
  projectName,
  description: 'VPC and networking infrastructure for Salem Flag Football',
});

// Database Stack - RDS PostgreSQL in private subnet
const databaseStack = new DatabaseStack(app, `${projectName}-database-${environment}`, {
  env: { account, region },
  environment,
  projectName,
  vpc: vpcStack.vpc,
  databaseSecurityGroup: vpcStack.databaseSecurityGroup,
  description: 'RDS PostgreSQL database for Salem Flag Football',
});

databaseStack.addDependency(vpcStack);

// Backend Stack - ECS Fargate service
const backendStack = new BackendStack(app, `${projectName}-backend-${environment}`, {
  env: { account, region },
  environment,
  projectName,
  vpc: vpcStack.vpc,
  databaseSecret: databaseStack.databaseSecret,
  databaseEndpoint: databaseStack.databaseEndpoint,
  databaseSecurityGroup: vpcStack.databaseSecurityGroup,
  description: 'ECS Fargate backend service for Salem Flag Football',
});

backendStack.addDependency(vpcStack);
backendStack.addDependency(databaseStack);

// Frontend Stack - S3 + CloudFront
const frontendStack = new FrontendStack(app, `${projectName}-frontend-${environment}`, {
  env: { account, region },
  environment,
  projectName,
  backendApiUrl: backendStack.apiUrl,
  description: 'S3 and CloudFront for Salem Flag Football frontend',
});

frontendStack.addDependency(backendStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', projectName);
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();

