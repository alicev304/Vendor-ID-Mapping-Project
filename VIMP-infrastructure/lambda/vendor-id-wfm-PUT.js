const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const bucket = process.env.BUCKET || '';

exports.handler = async (event, context, callback) => {
    console.log("Request: ", JSON.stringify(event));
    try {
        const body = isJson(event.body) ? JSON.parse(event.body) : event.body;
        console.log(`Body: ${body}`);
        const params = {
            Bucket: bucket,
            Key: body['vendor-id-wfm'],
            Body: body['vendor-name'] + '\n' + body['vendor-state']
        };
        console.log(JSON.stringify(params));
        await s3.putObject(params).promise();
        console.log("putObject successful")
        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: `Successfully hit ${event.path}\n`
        };
    } catch (error) {
        console.log(error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: 'Error: ' + error.message
        };
    }
};

function isJson (body) {
    try {
        JSON.parse(body);
    } catch (error) {
        return false;
    }
    return true;
}