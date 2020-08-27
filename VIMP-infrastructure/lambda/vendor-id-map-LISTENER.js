const AWS = require ('aws-sdk');
const lambda = new AWS.Lambda({
    region: "us-east-2"
});
const sns = new AWS.SNS();
const topic = process.env.TOPIC || '';

const stateCodes = ["AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", 
        "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", 
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", 
        "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", 
        "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"];

exports.handler = function (event, context, callback) {
    console.log('DynamoDB trigger activated. Invoking Lambda.');

    for (const record of event.Records) {
        if(record.eventName.localeCompare("INSERT") == 0) {
            console.log("INSERT received.");
            const vendorIdWfm = record.dynamodb.NewImage["vendor-id-wfm"].S;
            const vendorIdAmz = record.dynamodb.NewImage["vendor-id-amz"].S;
            console.log("Invoking putVendorIdWfmFunction")
            lambda.invoke({
                FunctionName: "putVendorIdWfmFunction",
                Payload: JSON.stringify({
                    "body": {
                        "vendor-id-wfm": vendorIdWfm,
                        "vendor-name": generateVendorName(vendorIdWfm),
                        "vendor-state": generateVendorState()
                    }
                })
            }, function(err, data) {
                if (err) {
                    console.log(err, err.stack);
                } else {
                    console.log("Invokation successful");
                    console.log(data);
                }
            });
            const snsMessage = {
                "vendor-id-amz": vendorIdAmz,
                "vendor-id-wfm": vendorIdWfm,
                "vendor-name": generateVendorName(vendorIdWfm),
                "vendor-state": generateVendorState()
            };
            sns.publish({
                Message: JSON.stringify(snsMessage),
                Subject: "New vendor mapping received",
                TopicArn: topic,
            }, context.done);
        } else {
            console.log(record.eventName, " received. Ignored.");
        }
    }
    return `Successfully processed ${event.Records.length} records.`;
};

function generateVendorName(vendorIdWfm) {
    return "name_" + vendorIdWfm.substring(3, 6);
}

function generateVendorState() {
    return stateCodes[Math.floor(Math.random() * stateCodes.length)];
}