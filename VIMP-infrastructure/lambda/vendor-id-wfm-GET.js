const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const bucket = process.env.BUCKET || '';

exports.handler = async (event, context, callback) => {
    console.log("request: ", JSON.stringify(event));
    try {
        const params = {
            Bucket: bucket,
            Key: event['pathParameters']['vendor-id-wfm']
        }
        const data = await s3.getObject(params).promise();
        console.log("Raw text: \n" + data.Body.toString('ascii'));
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "text/plain",
                "Access-Control-Allow-Origin": "*"
            },
            body: data.Body.toString('ascii'),
            isBase64Encoded: false
        };
    } catch (error) {
        console.log(error);
        return {
            statusCode: 400,
            headers: {
                "Content-Type": "text/plain",
                "Access-Control-Allow-Origin": "*"
            },
            body: "Item not found"
        };
    }
};