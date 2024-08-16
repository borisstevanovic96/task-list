import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

const client = new DynamoDBClient({ region: "us-east-2" });
const docClient = DynamoDBDocumentClient.from(client);

export const createUser = async (event) => {
  try {
    const { username, email, password } = JSON.parse(event.body);

    // Basic validation
    if (!username || !email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Username, email, and password are required" }),
      };
    }

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    const userItem = {
      id: uuidv4(), // Unique user ID
      username,
      email,
      password: hashedPassword, // Store hashed password
      createdAt: new Date().toISOString(),
    };

    // DynamoDB PutCommand
    const params = {
      TableName: "UsersTable", // Replace with your DynamoDB table name
      Item: userItem,
      ConditionExpression: "attribute_not_exists(email)", // Ensures the email is unique
    };

    await docClient.send(new PutCommand(params));

    return {
      statusCode: 201,
      body: JSON.stringify({ message: "User registered successfully" }),
    };
  } catch (error) {
    console.error("Error registering user:", error);

    if (error.name === "ConditionalCheckFailedException") {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Email already exists" }),
      };
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};




export const login = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    // Basic validation
    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Email and password are required" }),
      };
    }

    // Scan DynamoDB to find the user by email
    const params = {
      TableName: "UsersTable", // Replace with your DynamoDB table name
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email,
      },
    };

    const data = await docClient.send(new ScanCommand(params));

    if (!data.Items || data.Items.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid email or password" }),
      };
    }

    const user = data.Items[0];

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid email or password" }),
      };
    }

    // Successful login response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        }, // Return basic user information if needed
      }),
    };
  } catch (error) {
    console.error("Error during login:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
