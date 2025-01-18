import {
  Stack, StackProps, Duration,
  aws_sqs as sqs, aws_s3 as s3, aws_s3_notifications as s3n, aws_lambda as lambda, aws_lambda_event_sources as lambdaEventSources
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface SqsStackProps extends StackProps {
  lakeBucketArn: string;
}

export class SqsBTCBackupStack extends Stack {
  public readonly queue: sqs.Queue;

  constructor(scope: Construct, id: string, props: SqsStackProps) {
    super(scope, id, props);

    const bucketArn = props.lakeBucketArn;

    // Criar a fila SQS
    this.queue = new sqs.Queue(this, 'BtcStreamQueue', {
      queueName: 'btcStreamBkpQueue',
      visibilityTimeout: Duration.seconds(300),
      retentionPeriod: Duration.days(1),
    });

    // Criar a função Lambda
    const lambdaFunction = new lambda.Function(this, 'ProcessS3EventLambda', {
      functionName: 'process-s3-event',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/resources/lambda/process-s3-event'),
      timeout: Duration.minutes(1),
      environment: {
        QUEUE_URL: this.queue.queueUrl,
      },
    });

    // Conceder permissões à Lambda para enviar mensagens para a fila SQS
    this.queue.grantSendMessages(lambdaFunction);

    // Conceder permissões à Lambda para ler objetos do bucket S3
    const bucket = s3.Bucket.fromBucketArn(this, 'LakeBucket', bucketArn);
    bucket.grantRead(lambdaFunction);

    bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(lambdaFunction));
  }
}