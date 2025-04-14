# serverless-chatbot

---
## 🔗 Lambda Function URL

> https://dl7b7ydgzbd4ck2zxt5dftf7cy0rusib.lambda-url.us-east-1.on.aws/

---
## 🚀 Amplify Hosting

- The frontend is hosted using AWS Amplify.
- Visit the deployed chatbot here: https://staging.d2b9p7nceay2gs.amplifyapp.com/

---
## 🧠 DynamoDB Configuration

**Table Name**: `chat-history`

| Key         | Type   | Description                             |
|-------------|--------|-----------------------------------------|
| `user_id`   | String | Partition Key                           |
| `timestamp` | Number | Sort Key (used for chronological order) |
| `role`      | String | Message origin (`user` / `model`)       |
| `content`   | String | The actual message text                 |

Only the last 6 messages are queried and sent to the AI model to maintain short context.

---
