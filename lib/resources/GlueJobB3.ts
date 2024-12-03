import { Stack, StackProps, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_glue as glue, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';

interface GlueJobProps extends StackProps {
  scriptLocation: string;
  lakeBucketName: string;
  databaseName: string;
  rawTableName: string;
  refinedTableName: string;
  codesBucketName: string;
  jobName: string;
}
export class GlueJobStack extends Stack {
  constructor(scope: Construct, id: string, props: GlueJobProps) {
    super(scope, id, props);

    // Criação do papel IAM para o Glue Job
    const glueJobRole = new iam.Role(this, 'GlueJobRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });

    // Conceder permissões ao papel IAM para acessar os buckets S3
    const lakeBucket = s3.Bucket.fromBucketName(this, 'lakeBucket', props.lakeBucketName);
    const codesBucket = s3.Bucket.fromBucketName(this, 'CodesBucket', props.codesBucketName);
    lakeBucket.grantReadWrite(glueJobRole);
    codesBucket.grantRead(glueJobRole);

    // Criação do Glue Job
    new glue.CfnJob(this, 'GlueJob', {
      name: props.jobName,
      role: glueJobRole.roleArn,
      command: {
        name: 'glueetl',
        scriptLocation: props.scriptLocation,
        pythonVersion: '3',
      },
      defaultArguments: {
        '--job-language': 'python',
        '--enable-metrics': '',
        '--enable-continuous-cloudwatch-log': 'true',
        '--enable-spark-ui': 'true',
        '--spark-event-logs-path': `s3://${props.lakeBucketName}/sparkHistoryLogs/`,
        '--TempDir': `s3://${props.lakeBucketName}/temp/`,
        '--DATABASE_NAME': props.databaseName,
        '--RAW_TABLE_NAME': `${props.rawTableName}-raw`,
        '--REFINED_TABLE_NAME': props.refinedTableName,
        '--REFINED_BUCKET': props.lakeBucketName,
      },
      maxRetries: 0,
      timeout: 60, // 1 hora
      glueVersion: '4.0',
      numberOfWorkers: 2,
      workerType: 'G.1X',
    });
  }
}