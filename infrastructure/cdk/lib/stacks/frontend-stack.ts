import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfrontOrigins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface FrontendStackProps extends cdk.StackProps {
  environment: string;
  projectName: string;
  backendApiUrl: string;
}

export class FrontendStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const { environment, projectName, backendApiUrl } = props;

    // S3 Bucket for frontend assets - with security best practices
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${projectName}-frontend-${environment}-${this.account}`,
      versioned: environment === 'prod', // Enable versioning in prod
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Block all public access
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod', // Auto-delete objects when stack is deleted (non-prod)
      enforceSSL: true, // Require SSL for all requests
      cors: [
        {
          allowedOrigins: ['*'], // Configure based on your needs
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Origin Access Identity for CloudFront to access S3
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for ${projectName} frontend ${environment}`,
    });

    // Grant CloudFront access to S3 bucket
    this.bucket.grantRead(originAccessIdentity);

    // CloudFront Distribution with security headers
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(this.bucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
          comment: 'Security headers for frontend',
          securityHeadersBehavior: {
            strictTransportSecurity: {
              accessControlMaxAge: cdk.Duration.seconds(31536000),
              includeSubdomains: true,
              preload: true,
            },
            contentTypeOptions: { override: true },
            frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY },
            referrerPolicy: {
              referrerPolicy: cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            },
            xssProtection: {
              protection: true,
              modeBlock: true,
            },
          },
        }),
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(300),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(300),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe
      enableLogging: true,
      logBucket: new s3.Bucket(this, 'CloudFrontLogs', {
        bucketName: `${projectName}-cloudfront-logs-${environment}-${this.account}`,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        lifecycleRules: [
          {
            expiration: cdk.Duration.days(90), // Keep logs for 90 days
          },
        ],
      }),
      // Note: Add WAF WebACL for additional security
      // webAclId: wafWebAcl.attrArn,
    });

    // Deploy frontend build to S3
    // Note: This assumes you've built the frontend first
    // You can run: cd frontend && npm run build
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset('../frontend/build')],
      destinationBucket: this.bucket,
      distribution: this.distribution,
      distributionPaths: ['/*'],
      // Invalidate CloudFront cache on deployment
      prune: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `${projectName}-frontend-url-${environment}`,
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Frontend URL',
    });

    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket name for frontend assets',
    });
  }
}

