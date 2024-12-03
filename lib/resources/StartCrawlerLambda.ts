import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_lambda as lambda, aws_iam as iam } from 'aws-cdk-lib';

interface StartCrawlerLambdaProps extends StackProps {
  crawlerName: string;
}

export class StartCrawlerLambda extends Stack {
  public readonly startCrawlerLambda: lambda.Function;
  constructor(scope: Construct, id: string, props: StartCrawlerLambdaProps) {
    super(scope, id, props);

    // Função lambda para iniciar o crawler
    this.startCrawlerLambda = new lambda.Function(this, 'StartCrawlerLambda', {
      functionName: 'StartCrawlerLambda-tc2',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/resources/lambda/start-crawler'),
      timeout: Duration.minutes(1),
      environment: {
        CRAWLER_NAME: props.crawlerName,
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: ['glue:StartCrawler'],
          resources: [`arn:aws:glue:${this.region}:${this.account}:crawler/${props.crawlerName}`],
        }),
      ],
    });
  }
}