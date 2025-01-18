import {
  Stack, StackProps, Aws,
  aws_iam as iam, aws_s3 as s3, aws_kinesisfirehose as firehose
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface DataFirehoseResourcesProps extends StackProps {
  lakeBucketArn: string;
}

export class DataFirehoseResources extends Stack {
  constructor(scope: Construct, id: string, props: DataFirehoseResourcesProps) {
    super(scope, id, props);

    // Criar a role IAM para o Firehose
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    const bucketArn = props.lakeBucketArn;

    firehoseRole.addToPolicy(new iam.PolicyStatement({
      actions: ['s3:PutObject', 's3:GetObject', 's3:ListBucket'],
      resources: [bucketArn, `${bucketArn}/*`],
    }));

    // Criar o recurso do Firehose
    new firehose.CfnDeliveryStream(this, 'BtcStreamFirehose', {
      deliveryStreamName: 'btcStream',
      deliveryStreamType: 'DirectPut',
      extendedS3DestinationConfiguration: {
        bucketArn: bucketArn,
        roleArn: firehoseRole.roleArn,
        prefix: 'coleta!{partitionKeyFromQuery:coleta}/',
        errorOutputPrefix: 'error/',
        bufferingHints: {
          intervalInSeconds: 300,
          sizeInMBs: 64,
        },
        compressionFormat: 'UNCOMPRESSED',
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: '/aws/kinesisfirehose/btcStream',
          logStreamName: 'S3Delivery',
        },
        dynamicPartitioningConfiguration: {
          enabled: true,
          retryOptions: {
            durationInSeconds: 300,
          },
        },
        processingConfiguration: {
          enabled: true,
          processors: [
            {
              type: 'MetadataExtraction',
              parameters: [
                {
                  parameterName: 'MetadataExtractionQuery',
                  parameterValue: '{coleta:.coleta}',
                },
                {
                  parameterName: 'JsonParsingEngine',
                  parameterValue: 'JQ-1.6',
                },
              ],
            },
            {
              type: 'AppendDelimiterToRecord',
              parameters: [
                {
                  parameterName: 'Delimiter',
                  parameterValue: '\\n',
                },
              ],
            },
          ],
        },
      },
    });
  }
}