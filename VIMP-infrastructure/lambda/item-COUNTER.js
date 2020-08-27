const AWS = require ('aws-sdk');
const s3 = new AWS.S3({signatureVersion: 'v4'});
const ddb = new AWS.DynamoDB();

const bucket = process.env.BUCKET || '';
const table = process.env.TABLE || '';

exports.handler = async (event) => {
    const ddParams = {
        TableName: table
    };
    const s3Params = {
    	Bucket: bucket
	};
    const ddbTable = await ddb.describeTable(ddParams, function(err, data) {
        if (err) console.log(err, err.stack);
        else     console.log("ddbCount: ", data.Table.ItemCount);
    }).promise();
    const s3Bucket = await s3.listObjectsV2(s3Params, function(err, data) {
       if (err) console.log(err, err.stack);
       else     console.log("s3Count: ", data.Contents.length);
    }).promise();
    const response = {
        statusCode: 200,
        body: 'Counter executed.'
    };
    return response;
};
