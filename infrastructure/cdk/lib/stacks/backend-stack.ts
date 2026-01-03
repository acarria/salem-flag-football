import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface BackendStackProps extends cdk.StackProps {
  environment: string;
  projectName: string;
  vpc: ec2.Vpc;
  databaseSecret: secretsmanager.ISecret;
  databaseEndpoint: string;
  databaseSecurityGroup: ec2.SecurityGroup;
}

export class BackendStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const { environment, projectName, vpc, databaseSecret, databaseEndpoint, databaseSecurityGroup } = props;

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `${projectName}-cluster-${environment}`,
      vpc,
      containerInsights: true, // Enable CloudWatch Container Insights
    });

    // CloudWatch Log Group for ECS tasks
    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/ecs/${projectName}-backend-${environment}`,
      retention: environment === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Task Execution Role - for ECS to pull images and write logs
    const taskExecutionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    // Grant task execution role permission to read database secret
    databaseSecret.grantRead(taskExecutionRole);

    // Task Role - for the application running in the container
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      description: 'Role for backend ECS task',
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      family: `${projectName}-backend-${environment}`,
      cpu: environment === 'prod' ? 512 : 256,
      memoryLimitMiB: environment === 'prod' ? 1024 : 512,
      executionRole: taskExecutionRole,
      taskRole: taskRole,
    });

    // Container
    const container = taskDefinition.addContainer('BackendContainer', {
      image: ecs.ContainerImage.fromAsset('../..', {
        file: 'backend/Dockerfile',
      }),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'backend',
        logGroup,
      }),
      environment: {
        NODE_ENV: environment === 'prod' ? 'production' : 'development',
        DATABASE_HOST: databaseEndpoint,
        DATABASE_PORT: '5432',
        DATABASE_NAME: 'flagfootball',
      },
      secrets: {
        DATABASE_USER: ecs.Secret.fromSecretsManager(databaseSecret, 'username'),
        DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(databaseSecret, 'password'),
      },
    });

    container.addPortMappings({
      containerPort: 8000,
      protocol: ecs.Protocol.TCP,
    });

    // Application Load Balanced Fargate Service
    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'FargateService', {
      cluster,
      serviceName: `${projectName}-backend-${environment}`,
      taskDefinition,
      desiredCount: environment === 'prod' ? 2 : 1, // Multi-AZ for prod
      publicLoadBalancer: true,
      listenerPort: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      // Note: You'll need to add ACM certificate for HTTPS
      // certificate: acm.Certificate.fromCertificateArn(...),
      redirectHTTP: true, // Redirect HTTP to HTTPS
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      assignPublicIp: false, // Tasks in private subnets
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Configure health check
    fargateService.targetGroup.configureHealthCheck({
      path: '/health',
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Security: Restrict ALB security group to only allow backend traffic
    fargateService.loadBalancer.connections.allowFrom(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow HTTPS from VPC'
    );

    this.loadBalancer = fargateService.loadBalancer;
    this.apiUrl = `https://${fargateService.loadBalancer.loadBalancerDnsName}`;

    // Auto Scaling
    const scalableTarget = fargateService.service.autoScaleTaskCount({
      minCapacity: environment === 'prod' ? 2 : 1,
      maxCapacity: environment === 'prod' ? 10 : 3,
    });

    scalableTarget.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scalableTarget.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.apiUrl,
      description: 'Backend API URL',
      exportName: `${projectName}-api-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'LoadBalancerDns', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS Cluster name',
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: fargateService.service.serviceName,
      description: 'ECS Service name',
    });
  }
}

