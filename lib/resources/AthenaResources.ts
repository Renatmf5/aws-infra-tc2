import {
  Stack, StackProps, Duration,
  aws_s3 as s3, aws_lambda as lambda, aws_iam as iam, aws_athena as athena, aws_glue as glue, custom_resources as cr
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface AthenaProps extends StackProps {
  streamBucket: s3.Bucket;
  backupBucket: s3.Bucket;
}

export class AthenaStack extends Stack {
  constructor(scope: Construct, id: string, props: AthenaProps) {
    super(scope, id, props);

    // Criação do banco de dados do Glue
    const database = new glue.CfnDatabase(this, 'GlueDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'btc_stream_db',
      },
    });

    // Função Lambda para executar consultas no Athena
    const athenaQueryLambda = new lambda.Function(this, 'AthenaQueryLambda', {
      functionName: 'athena-create-query',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lib/resources/lambda/athena-query-string'),
      timeout: Duration.minutes(5),
      environment: {
        DATABASE_NAME: database.databaseName || 'btc_stream_db',
        STREAM_BUCKET_NAME: props.streamBucket.bucketName,
        BACKUP_BUCKET_NAME: props.backupBucket.bucketName,
      },
    });

    // Conceder permissões à Lambda para executar consultas no Athena
    athenaQueryLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['athena:StartQueryExecution', 'athena:GetQueryExecution', 'athena:GetQueryResults'],
      resources: ['*'],
    }));

    // Conceder permissões à Lambda para acessar os buckets S3
    props.streamBucket.grantRead(athenaQueryLambda);
    props.backupBucket.grantRead(athenaQueryLambda);

    // Custom Resource para invocar a Lambda durante o deploy
    new cr.AwsCustomResource(this, 'AthenaQueryCustomResource', {
      onCreate: {
        service: 'Lambda',
        action: 'invokeFunction',
        parameters: {
          FunctionName: athenaQueryLambda.functionName,
          InvocationType: 'Event',
        },
        physicalResourceId: cr.PhysicalResourceId.of('AthenaQueryCustomResource'),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [athenaQueryLambda.functionArn],
        }),
      ]),
    });
  }
}