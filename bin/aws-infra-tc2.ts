import * as cdk from 'aws-cdk-lib';
import { S3BucketResources } from '../lib/resources/S3BucketResources';
import { LambdaScrapB3 } from '../lib/resources/LambdaScrapB3';
import { GlueCrawlerStack } from '../lib/resources/GlueCrawlerB3';
import { GlueJobStack } from '../lib/resources/GlueJobB3';
import { StartCrawlerLambda } from '../lib/resources/StartCrawlerLambda';
import { GluePipelineStepFunction } from '../lib/resources/GluePipelineStepFunction';

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const app = new cdk.App();

// S3 Bucket Stack
const s3BucketApp = new S3BucketResources(app, 'S3BucketStack', {
  env: devEnv,
});

const lambdaScrapB3App = new LambdaScrapB3(app, 'LambdaScrapB3Stack', {
  env: devEnv,
});

// Glue Crawler Stack
const glueCrawlerApp = new GlueCrawlerStack(app, 'GlueCrawlerStack', {
  rawBucketName: `${process.env.BUCKETNAME_S3_LAKE}`,
  databaseName: process.env.GLUE_DATABASE_NAME || '',
  tableName: process.env.RAW_PREFIX_TABLE || '',
  crawlerName: process.env.CRAWLER_NAME || '',
  env: devEnv,
});

// Glue Job Stack
const glueJobApp = new GlueJobStack(app, 'GlueJobStack', {
  scriptLocation: `s3://${process.env.CODES_BUCKET_NAME}/glue-b3-script.py`,
  lakeBucketName: `${process.env.BUCKETNAME_S3_LAKE}`,
  databaseName: process.env.GLUE_DATABASE_NAME || '',
  rawTableName: process.env.RAW_PREFIX_TABLE || '',
  refinedTableName: process.env.REFINED_PREFIX_TABLE || '',
  codesBucketName: process.env.CODES_BUCKET_NAME || '',
  jobName: process.env.GLUE_JOB_NAME || '',
  env: devEnv,
});

// Start Crawlers Lambda Stack
const startCrawlerLambdaApp = new StartCrawlerLambda(app, 'StartCrawlerLambdaStack', {
  crawlerName: process.env.CRAWLER_NAME || '',
  env: devEnv,
});

// Glue Pipeline Step Function Stack
const gluePipelineStepFunctionApp = new GluePipelineStepFunction(app, 'GluePipelineStepFunctionStack', {
  startCrawlerLambdaArn: startCrawlerLambdaApp.startCrawlerLambda.functionArn,
  glueJobName: process.env.GLUE_JOB_NAME || '',
  rawBucketName: `${process.env.BUCKETNAME_S3_LAKE}`,
  env: devEnv,
});

lambdaScrapB3App.addDependency(s3BucketApp);
glueCrawlerApp.addDependency(s3BucketApp);
glueJobApp.addDependency(glueCrawlerApp);
startCrawlerLambdaApp.addDependency(glueCrawlerApp);
gluePipelineStepFunctionApp.addDependency(startCrawlerLambdaApp);

app.synth();