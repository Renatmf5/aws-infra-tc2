import {
  Stack, StackProps, Duration,
  aws_lambda as lambda, aws_iam as iam, aws_sqs as sqs, aws_events as events, aws_events_targets as targets, aws_s3 as s3
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface LambdaStackProps extends StackProps {
  queueArn: string;
  queueUrl: string;
  backupBucketName: string;
}

export class LambdaBtcBkpStack extends Stack {
  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    const { queueArn, queueUrl, backupBucketName } = props;

    // Criar a função Lambda
    const lambdaFunction = new lambda.Function(this, 'ProcessQueueLambda', {
      functionName: 'btc-backup-assync',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/resources/lambda/btc-backup-assync'),
      timeout: Duration.minutes(1),
      environment: {
        QUEUE_URL: queueUrl,
        BACKUP_BUCKET: backupBucketName,
      },
    });

    // Conceder permissões à Lambda
    const queue = sqs.Queue.fromQueueArn(this, 'BtcStreamQueue', queueArn);
    queue.grantConsumeMessages(lambdaFunction);

    const backupBucketArn = s3.Bucket.fromBucketName(this, 'BackupBucket', backupBucketName).bucketArn;
    lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject'],
      resources: [`${backupBucketArn}/*`],
    }));

    // Criar a regra do EventBridge
    const rule = new events.Rule(this, 'DailyEventRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '23' })
    });

    rule.addTarget(new targets.LambdaFunction(lambdaFunction));
  }
}