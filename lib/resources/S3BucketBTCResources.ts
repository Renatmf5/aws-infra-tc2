import {
  Stack, Duration, RemovalPolicy, StackProps,
  CfnOutput, Aws, aws_iam as iam, aws_s3 as s3, aws_logs as logs
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';

config();

export class S3BucketBTCResources extends Stack {
  // exportar variavel da instacia bucket criado
  public readonly buckeArn: s3.Bucket;
  public readonly bucketBkp: s3.Bucket;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const bucketName = process.env.BUCKETNAME_S3_STREAM_BTC;

    const bucketNameBkp = process.env.BUCKETNAME_S3_STREAM_BTC_BKP;

    // Criando um bucket S3 com finalidade de Data Lake para armazenar os dados de stream de BTC
    this.buckeArn = new s3.Bucket(this, 'DataLakeBucket', {
      versioned: false,
      bucketName: bucketName,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Criando um bucket S3 com a finalidade de armazenar o backup dos dados de stream de BTC usando inteligent Tier e glacier
    this.bucketBkp = new s3.Bucket(this, 'DataLakeBucketBkp', {
      versioned: false,
      bucketName: bucketNameBkp,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: Duration.days(0), // Transição imediata para Intelligent-Tiering
            },
          ],
        },
      ],
    });


    // Permissões para upload de arquivos
    const bucketPolicy = new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${this.buckeArn.bucketArn}/*`],
      principals: [new iam.AccountPrincipal(Aws.ACCOUNT_ID)],
    });

    // Permissões para upload de arquivos
    const bucketBkpPolicy = new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${this.bucketBkp.bucketArn}/*`],
      principals: [new iam.AccountPrincipal(Aws.ACCOUNT_ID)],
    });

    this.buckeArn.addToResourcePolicy(bucketPolicy);
    this.bucketBkp.addToResourcePolicy(bucketBkpPolicy);



    new CfnOutput(this, 'BucketName', {
      value: this.buckeArn.bucketName,
    });

  }
}