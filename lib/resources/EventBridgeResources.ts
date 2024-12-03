import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_events as events, aws_events_targets as targets, aws_lambda as lambda } from 'aws-cdk-lib';

interface EventBridgeSchedulerProps extends StackProps {
  lambdaFunction: lambda.Function;
}

export class EventBridgeScheduler extends Stack {
  constructor(scope: Construct, id: string, props: EventBridgeSchedulerProps) {
    super(scope, id, props);

    // Criação da regra do EventBridge para agendar a execução da Lambda
    const rule = new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '21',
        weekDay: 'MON-FRI', // Dias úteis da semana
      }),
    });

    // Adiciona a função Lambda como alvo da regra
    rule.addTarget(new targets.LambdaFunction(props.lambdaFunction));
  }
}