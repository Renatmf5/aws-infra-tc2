import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_stepfunctions as sfn, aws_stepfunctions_tasks as tasks, aws_lambda as lambda, aws_events as events, aws_events_targets as targets, aws_logs as logs } from 'aws-cdk-lib';

interface GluePipelineStepFunctionProps extends StackProps {
  startCrawlerLambdaArn: string;
  glueJobName: string;
  rawBucketName: string;
}

export class GluePipelineStepFunction extends Stack {
  constructor(scope: Construct, id: string, props: GluePipelineStepFunctionProps) {
    super(scope, id, props);

    // Referenciar a função Lambda existente
    const startCrawlerLambda = lambda.Function.fromFunctionArn(this, 'StartCrawlerLambda', props.startCrawlerLambdaArn);

    // Tarefa Step Funcion para inicia o Crawler
    const startCrawlerTask = new tasks.LambdaInvoke(this, 'StartCrawlerTask', {
      lambdaFunction: startCrawlerLambda,
    });

    // Tarefa Step Function para aguardar a conclusão do Crawler
    const waitForCrawlerTask = new sfn.Wait(this, 'WaitForCrawlerTask', {
      time: sfn.WaitTime.duration(Duration.minutes(5)),
    });

    // Tarefa Step Function para iniciar o Job do Glue
    const startJobTask = new tasks.GlueStartJobRun(this, 'StartJobTask', {
      glueJobName: props.glueJobName,
    });

    // Definição do Step Function
    const definition = startCrawlerTask
      .next(waitForCrawlerTask)
      .next(startJobTask);

    // Criação do Log Group para a Step Function
    const logGroup = new logs.LogGroup(this, 'GluePipelineLogGroup', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Criação da Step Function
    const stateMachine = new sfn.StateMachine(this, 'GluePipelineStepFunction', {
      definition,
      timeout: Duration.hours(1),
    });

    // Regra do EventBridge para acionar a Step Function quando um novo arquivo for adicionado ao bucket S3 Raw
    new events.Rule(this, 'NewFileRule', {
      eventPattern: {
        source: ['aws.s3'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['s3.amazonaws.com'],
          eventName: ['PutObject'],
          requestParameters: {
            bucketName: [props.rawBucketName],
            key: [{ prefix: 'Raw/' }],
          },
        },
      },
      targets: [new targets.SfnStateMachine(stateMachine)],
    });

  }
}