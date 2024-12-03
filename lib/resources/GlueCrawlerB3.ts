import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_glue as glue, aws_iam as iam, aws_s3 as s3 } from 'aws-cdk-lib';

interface GlueCrawlerProps extends StackProps {
  rawBucketName: string;
  databaseName: string;
  tableName: string;
  crawlerName: string;
}

export class GlueCrawlerStack extends Stack {
  constructor(scope: Construct, id: string, props: GlueCrawlerProps) {
    super(scope, id, props);

    // Criação do bucket S3 de origem
    const rawBucket = s3.Bucket.fromBucketName(this, 'RawBucket', props.rawBucketName);

    // Criação do papel IAM para o Crawler
    const glueRole = new iam.Role(this, 'GlueCrawlerRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
    });

    // Conceder permissões ao papel IAM para acessar o bucket S3
    rawBucket.grantRead(glueRole);

    // Criação do banco de dados do Glue
    const database = new glue.CfnDatabase(this, 'GlueDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: props.databaseName,
      },
    });

    // Criação do Crawler
    new glue.CfnCrawler(this, 'GlueCrawler', {
      name: props.crawlerName,
      role: glueRole.roleArn,
      databaseName: props.databaseName,
      targets: {
        s3Targets: [
          {
            path: `s3://${props.rawBucketName}/Raw`,
          },
        ],
      },
      tablePrefix: `${props.tableName}-`,
    });
  }
}