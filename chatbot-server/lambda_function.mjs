import {
  DynamoDBClient,
  QueryCommand,
  BatchWriteItemCommand
} from "@aws-sdk/client-dynamodb";

const dynamo = new DynamoDBClient({ region: "us-east-1" });

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const TABLE_NAME = 'chat-history';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

const validateRequest = (method, userPrompt, userId) => {
  if (method !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method Not Allowed. Use POST." }),
    };
  }

  if (!userPrompt || !userId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Missing 'user_prompt' or 'user_id' in request body." }),
    };
  }

  return {};
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod;

  if (method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "CORS preflight OK" }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const userPrompt = body.user_prompt;
    const userId = body.user_id;

    const validationResponse = validateRequest(method, userPrompt, userId);
    if (validationResponse.statusCode !== undefined) return validationResponse;

    const historyResponse = await dynamo.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "user_id = :uid",
      ExpressionAttributeValues: {
        ":uid": { S: userId }
      },
      ScanIndexForward: false,
      Limit: 6
    }));
  
    const messageHistory = historyResponse.Items || [];
    const reversedMessages = messageHistory.reverse();
    
    const messages = reversedMessages.map(m => ({
      role: m.role.S === "ai" ? "model" : "user",
      parts: [{ text: m.content.S }]
    }));
  
    if (userPrompt === '...') {
      const chatHistory = reversedMessages.map(m => ({
        sender: m.role.S === 'ai' || m.role.S === 'model' ? 'ai' : 'user',
        text: m.content.S
      }));
    
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ history: chatHistory })
      };
    }
    
    // Add current user prompt
    messages.push({
      role: "user",
      parts: [{ text: userPrompt }]
    });

    // Send to Gemini
    const geminiResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: messages
    });

    const aiReply = geminiResponse.candidates[0].content.parts[0].text;
    const timestamp = Date.now();

    await dynamo.send(new BatchWriteItemCommand({
      RequestItems: {
        [TABLE_NAME]: [
          {
            PutRequest: {
              Item: {
                user_id: { S: userId },
                timestamp: { N: timestamp.toString() },
                role: { S: "user" },
                content: { S: userPrompt }
              }
            }
          },
          {
            PutRequest: {
              Item: {
                user_id: { S: userId },
                timestamp: { N: (timestamp + 1).toString() },
                role: { S: "model" },
                content: { S: aiReply }
              }
            }
          }
        ]
      }
    }));
    

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ai_reply: aiReply }),
    };

  } catch (err) {
    console.error("Gemini API or DynamoDB error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
