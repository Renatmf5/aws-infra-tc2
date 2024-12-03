import {
  Stack, Duration, RemovalPolicy, StackProps,
  CfnOutput, Aws, aws_iam as iam, aws_s3 as s3, aws_logs as logs
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';

config();

export class S3BucketResources extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const bucketName = process.env.BUCKETNAME_S3_LAKE;

    // Criando um bucket S3 com finalidade de Data Lake para armazenar os dados extraídos de APIs, tambem tera 2 folders (Bronze e Silver)
    const bucket = new s3.Bucket(this, 'DataLakeBucket', {
      versioned: false,
      bucketName: bucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Adiciona as pastas Row e Refined
    bucket.addLifecycleRule({
      prefix: 'Raw/',
      enabled: true,
      expiration: Duration.days(365), // Expiração em 365 dias
    });

    // Adiciona as pastas Bronze e Silver
    bucket.addLifecycleRule({
      prefix: 'Refined/',
      enabled: true,
      expiration: Duration.days(365), // Expiração em 365 dias
    });

    // Adiciona as pastas Bronze e Silver
    bucket.addLifecycleRule({
      prefix: 'Gold/',
      enabled: true,
      expiration: Duration.days(365), // Expiração em 365 dias
    });

    // Permissões para upload de arquivos
    const bucketPolicy = new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${bucket.bucketArn}/*`],
      principals: [new iam.AccountPrincipal(Aws.ACCOUNT_ID)],
    });

    bucket.addToResourcePolicy(bucketPolicy);

    // Permissões para o EventBridge acessar eventos do S3
    const eventBridgePolicy = new iam.PolicyStatement({
      actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
      resources: [`${bucket.bucketArn}`, `${bucket.bucketArn}/*`],
      principals: [new iam.ServicePrincipal('events.amazonaws.com')],
    });

    bucket.addToResourcePolicy(eventBridgePolicy);

    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });

    // Criação do Log Group para o CloudTrail
    const logGroup = new logs.LogGroup(this, 'S3AccessLogs', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Criação do CloudTrail para monitorar o bucket S3
    const trail = new cloudtrail.Trail(this, 'S3AccessTrail', {
      bucket,
      isMultiRegionTrail: false,
      includeGlobalServiceEvents: false,
      managementEvents: cloudtrail.ReadWriteType.ALL,
      sendToCloudWatchLogs: true,
      cloudWatchLogGroup: logGroup,
    });

    // Adicionar o bucket S3 ao CloudTrail
    trail.addS3EventSelector([{
      bucket,
      objectPrefix: 'Raw/',
    }], {
      readWriteType: cloudtrail.ReadWriteType.ALL,
    });
  }
}