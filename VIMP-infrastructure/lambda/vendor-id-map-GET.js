const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME || '';
const PRIMARY_KEY = process.env.PRIMARY_KEY || '';

exports.handler = async (event, context, callback) => {
    const requestedItemId = event['pathParameters']['vendor-id-wfm'];
    if (!requestedItemId) {
        return { statusCode: 400, body: `Error: You are missing the path parameter id` };
    }

    const params = {
        TableName: TABLE_NAME,
        Key: {
            [PRIMARY_KEY]: requestedItemId
        }
    };

    try {
        const response = await db.get(params).promise();
        return { 
            statusCode: 200, 
            body: JSON.stringify(response.Item),
            headers: {
                "Access-Control-Allow-Origin": "*"
            }
        };
    } catch (error) {
        return { 
            statusCode: 500, 
            body: JSON.stringify(dbError),
            headers: {
                "Access-Control-Allow-Origin": "*"
            }
        };
    }
};