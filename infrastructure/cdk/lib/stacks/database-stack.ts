import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  environment: string;
  projectName: string;
  vpc: ec2.Vpc;
  databaseSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly databaseEndpoint: string;
  public readonly databaseInstance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { environment, projectName, vpc, databaseSecurityGroup } = props;

    // Create database credentials secret
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `${projectName}-db-credentials-${environment}`,
      description: 'RDS PostgreSQL database credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Create RDS Subnet Group in isolated subnets
    const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc,
      subnetGroupName: `${projectName}-db-subnet-group-${environment}`,
      description: 'Subnet group for RDS PostgreSQL database',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED, // Most secure - no internet access
      },
    });

    // Create RDS PostgreSQL instance with security best practices
    this.databaseInstance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        environment === 'prod' ? ec2.InstanceSize.MICRO : ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      subnetGroup,
      securityGroups: [databaseSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      databaseName: 'flagfootball',
      allocatedStorage: environment === 'prod' ? 100 : 20,
      maxAllocatedStorage: environment === 'prod' ? 200 : 100,
      storageEncrypted: true, // Encrypt database at rest
      multiAz: environment === 'prod', // Multi-AZ for production
      backupRetention: environment === 'prod' ? cdk.Duration.days(7) : cdk.Duration.days(3),
      deleteAutomatedBackups: environment !== 'prod',
      deletionProtection: environment === 'prod', // Prevent accidental deletion in prod
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      enablePerformanceInsights: environment === 'prod',
      performanceInsightRetention: environment === 'prod' 
        ? rds.PerformanceInsightRetention.MONTHS_1 
        : undefined,
      publiclyAccessible: false, // Never expose database to internet
      autoMinorVersionUpgrade: true,
      preferredBackupWindow: '03:00-04:00', // Backup during low-traffic hours
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
    });

    this.databaseEndpoint = this.databaseInstance.instanceEndpoint.hostname;

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.databaseInstance.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL endpoint',
      exportName: `${projectName}-db-endpoint-${environment}`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.databaseInstance.instanceEndpoint.port.toString(),
      description: 'RDS PostgreSQL port',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.databaseSecret.secretArn,
      description: 'ARN of the database credentials secret',
      exportName: `${projectName}-db-secret-arn-${environment}`,
    });
  }
}

