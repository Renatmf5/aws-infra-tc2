import {
  Stack, Duration, RemovalPolicy, StackProps,
  CfnOutput, Aws, aws_iam as iam, aws_s3 as s3, aws_lambda as lambda, aws_events as events, aws_events_targets as targets,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';

export class LambdaScrapB3 extends Stack {
  // cria variavel de saida para LambdaFunction
  public readonly lambdaFunction: lambda.Function;
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    config();

    const codesBucketName = process.env.CODES_BUCKET_NAME || '';
    const lambdaZipFileName = process.env.LAMBDA_SCRAP_ZIP_FILE_NAME || '';
    const lambdaLayerZipFileName = process.env.LAMBDA_LAYER_ZIP_FILE_NAME || '';
    const bucketLakeDestinoName = process.env.BUCKETNAME_S3_LAKE || '';

    // Referencia ao bucket onde o código da Lambda está armazenado
    const lambdaBucket = s3.Bucket.fromBucketName(this, 'ScrapB3LambdaBucket', codesBucketName);

    //

    // Adiciona layer com dependêcias onde esta armazenado no bucket
    const lambdaLayer = new lambda.LayerVersion(this, 'ScrapB3LambdaLayer_chromium', {
      code: lambda.Code.fromBucket(lambdaBucket, lambdaLayerZipFileName),
    });

    // Criação da função Lambda
    const lambdaFunction = new lambda.Function(this, 'ScrapB3LambdaFunction', {
      functionName: 'ScrapB3LambdaFunction',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromBucket(lambdaBucket, lambdaZipFileName),
      memorySize: 1024,
      timeout: Duration.minutes(1),
      environment: {
        BUCKET_NAME: lambdaBucket.bucketName,
      },
      layers: [lambdaLayer],
    });

    // Permissões para a função Lambda
    lambdaBucket.grantReadWrite(lambdaFunction);

    // Adiciona política de permissão para s3:PutObject
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`arn:aws:s3:::${bucketLakeDestinoName}/Raw/*`],
    }));

    // Adiciona lambda ao evento de schedule
    // Criação da regra do EventBridge para agendar a execução da Lambda
    const rule = new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '10',
        weekDay: 'MON-FRI', // Dias úteis da semana
      }),
    });

    // Adiciona a função Lambda como alvo da regra
    rule.addTarget(new targets.LambdaFunction(lambdaFunction));

  }
}