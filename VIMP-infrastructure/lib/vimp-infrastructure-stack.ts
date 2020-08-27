import * as cdk from '@aws-cdk/core';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import * as events from '@aws-cdk/aws-events';
import * as target from '@aws-cdk/aws-events-targets';
import * as eventsource from '@aws-cdk/aws-lambda-event-sources';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as sns from '@aws-cdk/aws-sns';
import * as sqs from '@aws-cdk/aws-sqs';
import * as subs from '@aws-cdk/aws-sns-subscriptions';

export class VimpInfrastructureStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'vendor-id-wfm', {
      bucketName: 'vendor-id-wfm'
    });

    const getVendorIdWfmLambda = new lambda.Function(this, 'getVendorIdWfmFunction', {
      functionName: 'getVendorIdWfmFunction',
      code: lambda.Code.fromAsset('lambda'),
      handler: 'vendor-id-wfm-GET.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        BUCKET: bucket.bucketName
      }
    });

    const putVendorIdWfmLambda = new lambda.Function(this, 'putVendorIdWfmFunction', {
      functionName: 'putVendorIdWfmFunction',
      code: lambda.Code.fromAsset('lambda'),
      handler: 'vendor-id-wfm-PUT.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        BUCKET: bucket.bucketName
      }
    });

    bucket.grantRead(getVendorIdWfmLambda);
    bucket.grantWrite(putVendorIdWfmLambda);

    const ddbTable = new dynamodb.Table(this, 'vendor-id-map', {
      tableName: 'vendor-id-map',
      partitionKey: {
        name: 'vendor-id-wfm',
        type: dynamodb.AttributeType.STRING
      },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
    });

    const getVendorIdMapLambda = new lambda.Function(this, 'getVendorIdMapFunction', {
      functionName: 'getVendorIdMapFunction',
      code: lambda.Code.fromAsset('lambda'),
      handler: 'vendor-id-map-GET.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: ddbTable.tableName,
        PRIMARY_KEY: 'vendor-id-wfm'
      }
    });

    const putVendorIdMapLambda = new lambda.Function(this, 'putVendorIdMapFunction', {
      functionName: 'putVendorIdMapFunction',
      code: lambda.Code.fromAsset('lambda'),
      handler: 'vendor-id-map-PUT.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TABLE_NAME: ddbTable.tableName
      }
    });

    ddbTable.grantReadData(getVendorIdMapLambda);
    ddbTable.grantWriteData(putVendorIdMapLambda);

    const api = new apigateway.RestApi(this, 'vimp-api', {
      restApiName: 'VIMP API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS
      }
    });

    const vendors = api.root.addResource('vendor-id-wfm');
    const vendorId = vendors.addResource('{vendor-id-wfm}');
    const vendorIdMap = api.root.addResource('vendor-id-map');
    const mapWfmId = vendorIdMap.addResource('{vendor-id-wfm}');

    const getVendorIdWfmIntegration = new apigateway.LambdaIntegration(getVendorIdWfmLambda);
    const putVendorIdWfmIntegration = new apigateway.LambdaIntegration(putVendorIdWfmLambda, {
      proxy: true
    });
    const getVendorIdMapIntegration = new apigateway.LambdaIntegration(getVendorIdMapLambda);
    const putVendorIdMapIntegration = new apigateway.LambdaIntegration(putVendorIdMapLambda);

    vendorId.addMethod('GET', getVendorIdWfmIntegration);
    vendors.addMethod('PUT', putVendorIdWfmIntegration);
    mapWfmId.addMethod('GET', getVendorIdMapIntegration);
    vendorIdMap.addMethod('PUT', putVendorIdMapIntegration);

    const tableStream = dynamodb.Table.fromTableAttributes(this, 'vendorIdMapStream', {
      tableName: ddbTable.tableName,
      tableStreamArn: ddbTable.tableStreamArn
    });

    const newVendorSns = new sns.Topic(this, "new-vendor-mapping", {
      displayName: "new-vendor-mapping-sns",
      topicName: "new-vendor-mapping-topic"
    });

    const listenVendorIdMapLambda = new lambda.Function(this, 'listenVendorIdMapFunction', {
      functionName: 'listenVendorIdMapFunction',
      code: lambda.Code.fromAsset('lambda'),
      handler: 'vendor-id-map-LISTENER.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        TOPIC: newVendorSns.topicArn
      }
    });

    listenVendorIdMapLambda.addEventSource(new eventsource.DynamoEventSource(tableStream, {
      startingPosition: lambda.StartingPosition.LATEST
    }));

    ddbTable.grantFullAccess(listenVendorIdMapLambda);
    putVendorIdWfmLambda.grantInvoke(listenVendorIdMapLambda);
    newVendorSns.grantPublish(listenVendorIdMapLambda);

    const newVendorSqs = new sqs.Queue(this, "new-vendor-mapping-queue", {
      queueName: "new-vendor-mapping-sqs"
    });

    newVendorSns.addSubscription(new subs.SqsSubscription(newVendorSqs));

    const itemCounterLambda = new lambda.Function(this, 'itemCounterFunction', {
      functionName: 'itemCounterFunction',
      code: lambda.Code.fromAsset('lambda'),
      handler: 'item-COUNTER.handler',
      runtime: lambda.Runtime.NODEJS_10_X,
      environment: {
        BUCKET: bucket.bucketName,
        TABLE: ddbTable.tableName
      }
    });

    bucket.grantRead(itemCounterLambda);
    ddbTable.grantReadData(itemCounterLambda);

    // const rule = new events.Rule(this, 'itemCounterRule', {
    //   schedule: events.Schedule.rate(cdk.Duration.seconds(60)),
    //   description: "item-counter-rule"
    // });

    // rule.addTarget(new target.LambdaFunction(itemCounterLambda));

  }

}
