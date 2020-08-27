const AWS = require('aws-sdk');
const db = new AWS.DynamoDB.DocumentClient();

const TABLE_NAME = process.env.TABLE_NAME || '';

exports.handler = async (event, context, callback) => {

    if (!event.body) {
        return { 
            statusCode: 400, 
            body: 'invalid request, you are missing the parameter body' 
        };
    }
    const item = typeof event.body == 'object' ? event.body : JSON.parse(event.body);
    const params = {
        TableName: TABLE_NAME,
        Item: item
    };

    try {
        await db.put(params).promise();
        return { 
            statusCode: 201, 
            body: 'successfully added mapping',
            headers: {
                "Access-Control-Allow-Origin": "*"
            }
        };
    } catch (error) {
        console.log(error);
        return { 
            statusCode: 500, 
            body: error,
            headers: {
                "Access-Control-Allow-Origin": "*"
            }
        };
    }
};