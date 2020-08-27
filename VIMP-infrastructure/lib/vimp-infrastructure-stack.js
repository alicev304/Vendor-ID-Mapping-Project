"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VimpInfrastructureStack = void 0;
const cdk = require("@aws-cdk/core");
const apigateway = require("@aws-cdk/aws-apigateway");
const dynamodb = require("@aws-cdk/aws-dynamodb");
const eventsource = require("@aws-cdk/aws-lambda-event-sources");
const lambda = require("@aws-cdk/aws-lambda");
const s3 = require("@aws-cdk/aws-s3");
const sns = require("@aws-cdk/aws-sns");
const sqs = require("@aws-cdk/aws-sqs");
const subs = require("@aws-cdk/aws-sns-subscriptions");
class VimpInfrastructureStack extends cdk.Stack {
    constructor(scope, id, props) {
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
        //   schedule: events.Schedule.rate(Duration.seconds(60)),
        //   description: "item-counter-rule"
        // });
        // rule.addTarget(new target.LambdaFunction(itemCounterLambda));
    }
}
exports.VimpInfrastructureStack = VimpInfrastructureStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmltcC1pbmZyYXN0cnVjdHVyZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInZpbXAtaW5mcmFzdHJ1Y3R1cmUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEscUNBQXFDO0FBQ3JDLHNEQUFzRDtBQUN0RCxrREFBa0Q7QUFHbEQsaUVBQWlFO0FBQ2pFLDhDQUE4QztBQUM5QyxzQ0FBc0M7QUFDdEMsd0NBQXdDO0FBQ3hDLHdDQUF3QztBQUN4Qyx1REFBdUQ7QUFHdkQsTUFBYSx1QkFBd0IsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNwRCxZQUFZLEtBQW9CLEVBQUUsRUFBVSxFQUFFLEtBQXNCO1FBQ2xFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sTUFBTSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ2xELFVBQVUsRUFBRSxlQUFlO1NBQzVCLENBQUMsQ0FBQztRQUVILE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRTtZQUMvRSxZQUFZLEVBQUUsd0JBQXdCO1lBQ3RDLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUM7WUFDckMsT0FBTyxFQUFFLDJCQUEyQjtZQUNwQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLFdBQVcsRUFBRTtnQkFDWCxNQUFNLEVBQUUsTUFBTSxDQUFDLFVBQVU7YUFDMUI7U0FDRixDQUFDLENBQUM7UUFFSCxNQUFNLG9CQUFvQixHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDL0UsWUFBWSxFQUFFLHdCQUF3QjtZQUN0QyxJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMs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QUM7Q0FFRjtBQW5KRCwwREFtSkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnQGF3cy1jZGsvY29yZSc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ0Bhd3MtY2RrL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ0Bhd3MtY2RrL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnQGF3cy1jZGsvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXQgZnJvbSAnQGF3cy1jZGsvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGV2ZW50c291cmNlIGZyb20gJ0Bhd3MtY2RrL2F3cy1sYW1iZGEtZXZlbnQtc291cmNlcyc7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnQGF3cy1jZGsvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdAYXdzLWNkay9hd3MtczMnO1xuaW1wb3J0ICogYXMgc25zIGZyb20gJ0Bhd3MtY2RrL2F3cy1zbnMnO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ0Bhd3MtY2RrL2F3cy1zcXMnO1xuaW1wb3J0ICogYXMgc3VicyBmcm9tICdAYXdzLWNkay9hd3Mtc25zLXN1YnNjcmlwdGlvbnMnO1xuaW1wb3J0IHsgRHVyYXRpb24gfSBmcm9tICdAYXdzLWNkay9jb3JlJztcblxuZXhwb3J0IGNsYXNzIFZpbXBJbmZyYXN0cnVjdHVyZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IGNkay5Db25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ3ZlbmRvci1pZC13Zm0nLCB7XG4gICAgICBidWNrZXROYW1lOiAndmVuZG9yLWlkLXdmbSdcbiAgICB9KTtcblxuICAgIGNvbnN0IGdldFZlbmRvcklkV2ZtTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnZ2V0VmVuZG9ySWRXZm1GdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2dldFZlbmRvcklkV2ZtRnVuY3Rpb24nLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIGhhbmRsZXI6ICd2ZW5kb3ItaWQtd2ZtLUdFVC5oYW5kbGVyJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xMF9YLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgQlVDS0VUOiBidWNrZXQuYnVja2V0TmFtZVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgcHV0VmVuZG9ySWRXZm1MYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdwdXRWZW5kb3JJZFdmbUZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAncHV0VmVuZG9ySWRXZm1GdW5jdGlvbicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgaGFuZGxlcjogJ3ZlbmRvci1pZC13Zm0tUFVULmhhbmRsZXInLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzEwX1gsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBCVUNLRVQ6IGJ1Y2tldC5idWNrZXROYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBidWNrZXQuZ3JhbnRSZWFkKGdldFZlbmRvcklkV2ZtTGFtYmRhKTtcbiAgICBidWNrZXQuZ3JhbnRXcml0ZShwdXRWZW5kb3JJZFdmbUxhbWJkYSk7XG5cbiAgICBjb25zdCBkZGJUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAndmVuZG9yLWlkLW1hcCcsIHtcbiAgICAgIHRhYmxlTmFtZTogJ3ZlbmRvci1pZC1tYXAnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgIG5hbWU6ICd2ZW5kb3ItaWQtd2ZtJyxcbiAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkdcbiAgICAgIH0sXG4gICAgICBzdHJlYW06IGR5bmFtb2RiLlN0cmVhbVZpZXdUeXBlLk5FV19BTkRfT0xEX0lNQUdFU1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ2V0VmVuZG9ySWRNYXBMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdnZXRWZW5kb3JJZE1hcEZ1bmN0aW9uJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAnZ2V0VmVuZG9ySWRNYXBGdW5jdGlvbicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYScpLFxuICAgICAgaGFuZGxlcjogJ3ZlbmRvci1pZC1tYXAtR0VULmhhbmRsZXInLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzEwX1gsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBUQUJMRV9OQU1FOiBkZGJUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBSSU1BUllfS0VZOiAndmVuZG9yLWlkLXdmbSdcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IHB1dFZlbmRvcklkTWFwTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAncHV0VmVuZG9ySWRNYXBGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ3B1dFZlbmRvcklkTWFwRnVuY3Rpb24nLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIGhhbmRsZXI6ICd2ZW5kb3ItaWQtbWFwLVBVVC5oYW5kbGVyJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xMF9YLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVEFCTEVfTkFNRTogZGRiVGFibGUudGFibGVOYW1lXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBkZGJUYWJsZS5ncmFudFJlYWREYXRhKGdldFZlbmRvcklkTWFwTGFtYmRhKTtcbiAgICBkZGJUYWJsZS5ncmFudFdyaXRlRGF0YShwdXRWZW5kb3JJZE1hcExhbWJkYSk7XG5cbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICd2aW1wLWFwaScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiAnVklNUCBBUEknLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBhcGlnYXRld2F5LkNvcnMuREVGQVVMVF9IRUFERVJTXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCB2ZW5kb3JzID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3ZlbmRvci1pZC13Zm0nKTtcbiAgICBjb25zdCB2ZW5kb3JJZCA9IHZlbmRvcnMuYWRkUmVzb3VyY2UoJ3t2ZW5kb3ItaWQtd2ZtfScpO1xuICAgIGNvbnN0IHZlbmRvcklkTWFwID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ3ZlbmRvci1pZC1tYXAnKTtcbiAgICBjb25zdCBtYXBXZm1JZCA9IHZlbmRvcklkTWFwLmFkZFJlc291cmNlKCd7dmVuZG9yLWlkLXdmbX0nKTtcblxuICAgIGNvbnN0IGdldFZlbmRvcklkV2ZtSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRWZW5kb3JJZFdmbUxhbWJkYSk7XG4gICAgY29uc3QgcHV0VmVuZG9ySWRXZm1JbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHB1dFZlbmRvcklkV2ZtTGFtYmRhLCB7XG4gICAgICBwcm94eTogdHJ1ZVxuICAgIH0pO1xuICAgIGNvbnN0IGdldFZlbmRvcklkTWFwSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihnZXRWZW5kb3JJZE1hcExhbWJkYSk7XG4gICAgY29uc3QgcHV0VmVuZG9ySWRNYXBJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKHB1dFZlbmRvcklkTWFwTGFtYmRhKTtcblxuICAgIHZlbmRvcklkLmFkZE1ldGhvZCgnR0VUJywgZ2V0VmVuZG9ySWRXZm1JbnRlZ3JhdGlvbik7XG4gICAgdmVuZG9ycy5hZGRNZXRob2QoJ1BVVCcsIHB1dFZlbmRvcklkV2ZtSW50ZWdyYXRpb24pO1xuICAgIG1hcFdmbUlkLmFkZE1ldGhvZCgnR0VUJywgZ2V0VmVuZG9ySWRNYXBJbnRlZ3JhdGlvbik7XG4gICAgdmVuZG9ySWRNYXAuYWRkTWV0aG9kKCdQVVQnLCBwdXRWZW5kb3JJZE1hcEludGVncmF0aW9uKTtcblxuICAgIGNvbnN0IHRhYmxlU3RyZWFtID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlQXR0cmlidXRlcyh0aGlzLCAndmVuZG9ySWRNYXBTdHJlYW0nLCB7XG4gICAgICB0YWJsZU5hbWU6IGRkYlRhYmxlLnRhYmxlTmFtZSxcbiAgICAgIHRhYmxlU3RyZWFtQXJuOiBkZGJUYWJsZS50YWJsZVN0cmVhbUFyblxuICAgIH0pO1xuXG4gICAgY29uc3QgbmV3VmVuZG9yU25zID0gbmV3IHNucy5Ub3BpYyh0aGlzLCBcIm5ldy12ZW5kb3ItbWFwcGluZ1wiLCB7XG4gICAgICBkaXNwbGF5TmFtZTogXCJuZXctdmVuZG9yLW1hcHBpbmctc25zXCIsXG4gICAgICB0b3BpY05hbWU6IFwibmV3LXZlbmRvci1tYXBwaW5nLXRvcGljXCJcbiAgICB9KTtcblxuICAgIGNvbnN0IGxpc3RlblZlbmRvcklkTWFwTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnbGlzdGVuVmVuZG9ySWRNYXBGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2xpc3RlblZlbmRvcklkTWFwRnVuY3Rpb24nLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIGhhbmRsZXI6ICd2ZW5kb3ItaWQtbWFwLUxJU1RFTkVSLmhhbmRsZXInLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzEwX1gsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBUT1BJQzogbmV3VmVuZG9yU25zLnRvcGljQXJuXG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBsaXN0ZW5WZW5kb3JJZE1hcExhbWJkYS5hZGRFdmVudFNvdXJjZShuZXcgZXZlbnRzb3VyY2UuRHluYW1vRXZlbnRTb3VyY2UodGFibGVTdHJlYW0sIHtcbiAgICAgIHN0YXJ0aW5nUG9zaXRpb246IGxhbWJkYS5TdGFydGluZ1Bvc2l0aW9uLkxBVEVTVFxuICAgIH0pKTtcblxuICAgIGRkYlRhYmxlLmdyYW50RnVsbEFjY2VzcyhsaXN0ZW5WZW5kb3JJZE1hcExhbWJkYSk7XG4gICAgcHV0VmVuZG9ySWRXZm1MYW1iZGEuZ3JhbnRJbnZva2UobGlzdGVuVmVuZG9ySWRNYXBMYW1iZGEpO1xuICAgIG5ld1ZlbmRvclNucy5ncmFudFB1Ymxpc2gobGlzdGVuVmVuZG9ySWRNYXBMYW1iZGEpO1xuXG4gICAgY29uc3QgbmV3VmVuZG9yU3FzID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCBcIm5ldy12ZW5kb3ItbWFwcGluZy1xdWV1ZVwiLCB7XG4gICAgICBxdWV1ZU5hbWU6IFwibmV3LXZlbmRvci1tYXBwaW5nLXNxc1wiXG4gICAgfSk7XG5cbiAgICBuZXdWZW5kb3JTbnMuYWRkU3Vic2NyaXB0aW9uKG5ldyBzdWJzLlNxc1N1YnNjcmlwdGlvbihuZXdWZW5kb3JTcXMpKTtcblxuICAgIGNvbnN0IGl0ZW1Db3VudGVyTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnaXRlbUNvdW50ZXJGdW5jdGlvbicsIHtcbiAgICAgIGZ1bmN0aW9uTmFtZTogJ2l0ZW1Db3VudGVyRnVuY3Rpb24nLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEnKSxcbiAgICAgIGhhbmRsZXI6ICdpdGVtLUNPVU5URVIuaGFuZGxlcicsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMTBfWCxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEJVQ0tFVDogYnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFRBQkxFOiBkZGJUYWJsZS50YWJsZU5hbWVcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGJ1Y2tldC5ncmFudFJlYWQoaXRlbUNvdW50ZXJMYW1iZGEpO1xuICAgIGRkYlRhYmxlLmdyYW50UmVhZERhdGEoaXRlbUNvdW50ZXJMYW1iZGEpO1xuXG4gICAgLy8gY29uc3QgcnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnaXRlbUNvdW50ZXJSdWxlJywge1xuICAgIC8vICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5yYXRlKER1cmF0aW9uLnNlY29uZHMoNjApKSxcbiAgICAvLyAgIGRlc2NyaXB0aW9uOiBcIml0ZW0tY291bnRlci1ydWxlXCJcbiAgICAvLyB9KTtcblxuICAgIC8vIHJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXQuTGFtYmRhRnVuY3Rpb24oaXRlbUNvdW50ZXJMYW1iZGEpKTtcblxuICB9XG5cbn1cbiJdfQ==