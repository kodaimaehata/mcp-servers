#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Type definitions for tool arguments
interface ListChannelsArgs {
  limit?: number;
  cursor?: string;
}

interface PostMessageArgs {
  channel_id: string;
  text: string;
}

interface ReplyToThreadArgs {
  channel_id: string;
  thread_ts: string;
  text: string;
}

interface AddReactionArgs {
  channel_id: string;
  timestamp: string;
  reaction: string;
}

interface GetChannelHistoryArgs {
  channel_id: string;
  limit?: number;
}

interface GetThreadRepliesArgs {
  channel_id: string;
  thread_ts: string;
}

interface GetUsersArgs {
  cursor?: string;
  limit?: number;
}

interface GetUserProfileArgs {
  user_id: string;
}

interface DownloadThreadFilesArgs {
  channel_id: string;
  thread_ts: string;
  output_folder: string;
}

interface UploadFileToThreadArgs {
  channel_id: string;
  thread_ts: string;
  file_path: string;
  title?: string;
  initial_comment?: string;
}

// Tool definitions
const listChannelsTool: Tool = {
  name: "slack_list_channels",
  description: "List public channels in the workspace with pagination",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description:
          "Maximum number of channels to return (default 100, max 200)",
        default: 100,
      },
      cursor: {
        type: "string",
        description: "Pagination cursor for next page of results",
      },
    },
  },
};

const postMessageTool: Tool = {
  name: "slack_post_message",
  description: "Post a new message to a Slack channel",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description: "The ID of the channel to post to",
      },
      text: {
        type: "string",
        description: "The message text to post",
      },
    },
    required: ["channel_id", "text"],
  },
};

const replyToThreadTool: Tool = {
  name: "slack_reply_to_thread",
  description: "Reply to a specific message thread in Slack",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description: "The ID of the channel containing the thread",
      },
      thread_ts: {
        type: "string",
        description: "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it.",
      },
      text: {
        type: "string",
        description: "The reply text",
      },
    },
    required: ["channel_id", "thread_ts", "text"],
  },
};

const addReactionTool: Tool = {
  name: "slack_add_reaction",
  description: "Add a reaction emoji to a message",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description: "The ID of the channel containing the message",
      },
      timestamp: {
        type: "string",
        description: "The timestamp of the message to react to",
      },
      reaction: {
        type: "string",
        description: "The name of the emoji reaction (without ::)",
      },
    },
    required: ["channel_id", "timestamp", "reaction"],
  },
};

const getChannelHistoryTool: Tool = {
  name: "slack_get_channel_history",
  description: "Get recent messages from a channel",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description: "The ID of the channel",
      },
      limit: {
        type: "number",
        description: "Number of messages to retrieve (default 10)",
        default: 10,
      },
    },
    required: ["channel_id"],
  },
};

const getThreadRepliesTool: Tool = {
  name: "slack_get_thread_replies",
  description: "Get all replies in a message thread",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description: "The ID of the channel containing the thread",
      },
      thread_ts: {
        type: "string",
        description: "The timestamp of the parent message in the format '1234567890.123456'. Timestamps in the format without the period can be converted by adding the period such that 6 numbers come after it.",
      },
    },
    required: ["channel_id", "thread_ts"],
  },
};

const getUsersTool: Tool = {
  name: "slack_get_users",
  description:
    "Get a list of all users in the workspace with their basic profile information",
  inputSchema: {
    type: "object",
    properties: {
      cursor: {
        type: "string",
        description: "Pagination cursor for next page of results",
      },
      limit: {
        type: "number",
        description: "Maximum number of users to return (default 100, max 200)",
        default: 100,
      },
    },
  },
};

const getUserProfileTool: Tool = {
  name: "slack_get_user_profile",
  description: "Get detailed profile information for a specific user",
  inputSchema: {
    type: "object",
    properties: {
      user_id: {
        type: "string",
        description: "The ID of the user",
      },
    },
    required: ["user_id"],
  },
};

const downloadThreadFilesTool: Tool = {
  name: "slack_download_thread_files",
  description: "Download files attached to a Slack thread to a specified folder",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description: "The ID of the channel containing the thread",
      },
      thread_ts: {
        type: "string",
        description: "The timestamp of the parent message in the format '1234567890.123456'",
      },
      output_folder: {
        type: "string",
        description: "Folder path where the files should be downloaded",
      },
    },
    required: ["channel_id", "thread_ts", "output_folder"],
  },
};

const uploadFileToThreadTool: Tool = {
  name: "slack_upload_file_to_thread",
  description: "Upload a file as a reply to a specific Slack thread",
  inputSchema: {
    type: "object",
    properties: {
      channel_id: {
        type: "string",
        description: "The ID of the channel containing the thread"
      },
      thread_ts: {
        type: "string",
        description: "The timestamp of the parent message in the format '1234567890.123456'"
      },
      file_path: {
        type: "string",
        description: "Path to the file to upload"
      },
      title: {
        type: "string",
        description: "Title of the file (optional)"
      },
      initial_comment: {
        type: "string",
        description: "Text message to accompany the file (optional)"
      }
    },
    required: ["channel_id", "thread_ts", "file_path"],
  },
};

class SlackClient {
  private botHeaders: { Authorization: string; "Content-Type": string };

  constructor(botToken: string) {
    this.botHeaders = {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json",
    };
  }

  async getChannels(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      types: "public_channel",
      exclude_archived: "true",
      limit: Math.min(limit, 200).toString(),
      team_id: process.env.SLACK_TEAM_ID!,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(
      `https://slack.com/api/conversations.list?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async postMessage(channel_id: string, text: string): Promise<any> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        text: text,
      }),
    });

    return response.json();
  }

  async postReply(
    channel_id: string,
    thread_ts: string,
    text: string,
  ): Promise<any> {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        thread_ts: thread_ts,
        text: text,
      }),
    });

    return response.json();
  }

  async addReaction(
    channel_id: string,
    timestamp: string,
    reaction: string,
  ): Promise<any> {
    const response = await fetch("https://slack.com/api/reactions.add", {
      method: "POST",
      headers: this.botHeaders,
      body: JSON.stringify({
        channel: channel_id,
        timestamp: timestamp,
        name: reaction,
      }),
    });

    return response.json();
  }

  async getChannelHistory(
    channel_id: string,
    limit: number = 10,
  ): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      limit: limit.toString(),
    });

    const response = await fetch(
      `https://slack.com/api/conversations.history?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async getThreadReplies(channel_id: string, thread_ts: string): Promise<any> {
    const params = new URLSearchParams({
      channel: channel_id,
      ts: thread_ts,
    });

    const response = await fetch(
      `https://slack.com/api/conversations.replies?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async getUsers(limit: number = 100, cursor?: string): Promise<any> {
    const params = new URLSearchParams({
      limit: Math.min(limit, 200).toString(),
      team_id: process.env.SLACK_TEAM_ID!,
    });

    if (cursor) {
      params.append("cursor", cursor);
    }

    const response = await fetch(`https://slack.com/api/users.list?${params}`, {
      headers: this.botHeaders,
    });

    return response.json();
  }

  async getUserProfile(user_id: string): Promise<any> {
    const params = new URLSearchParams({
      user: user_id,
      include_labels: "true",
    });

    const response = await fetch(
      `https://slack.com/api/users.profile.get?${params}`,
      { headers: this.botHeaders },
    );

    return response.json();
  }

  async downloadThreadFiles(
    channel_id: string,
    thread_ts: string,
    output_folder: string
  ): Promise<string[]> {
    // Get all messages in the thread
    const threadData = await this.getThreadReplies(channel_id, thread_ts);
    
    if (!threadData.ok) {
      throw new Error(`Failed to get thread data: ${threadData.error}`);
    }

    const fileNames: string[] = [];
    const fs = await import('fs');
    const path = await import('path');
    const https = await import('https');

    // Check if output folder exists, if not throw an error
    if (!fs.existsSync(output_folder)) {
      throw new Error(`Output folder does not exist: ${output_folder}`);
    }

    // Extract files from all messages in the thread
    const promises = threadData.messages
      .filter((message: any) => message.files && message.files.length > 0)
      .flatMap((message: any) => 
        message.files.map(async (file: any) => {
          // Create a safe filename
          const fileName = path.join(
            output_folder, 
            file.name.replace(/[/\\?%*:|"<>]/g, '_')
          );
          
          // Download the file
          await new Promise<void>((resolve, reject) => {
            const fileRequest = https.get(
              file.url_private,
              { headers: { Authorization: this.botHeaders.Authorization } },
              (response) => {
                if (response.statusCode !== 200) {
                  reject(new Error(`Failed to download file: ${response.statusCode}`));
                  return;
                }
                
                const fileStream = fs.createWriteStream(fileName);
                response.pipe(fileStream);
                
                fileStream.on('finish', () => {
                  fileStream.close();
                  fileNames.push(fileName);
                  resolve();
                });
              }
            );
            
            fileRequest.on('error', (err) => {
              fs.unlink(fileName, () => {}); // Delete partially downloaded file
              reject(err);
            });
            
            fileRequest.end();
          });
        })
      );

    await Promise.all(promises);
    return fileNames;
  }

  async uploadFileToThread(
    channel_id: string,
    thread_ts: string,
    file_path: string,
    title?: string,
    initial_comment?: string
  ): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');
    const { Buffer } = await import('buffer');

    // Check if file exists
    if (!fs.existsSync(file_path)) {
      throw new Error(`File does not exist: ${file_path}`);
    }

    // Get file info
    const fileStats = fs.statSync(file_path);
    const fileSize = fileStats.size;
    const filename = path.basename(file_path);
    const fileContent = fs.readFileSync(file_path);

    // Step 1: Get upload URL and file ID using files.getUploadURLExternal
    let upload_url = '';
    let file_id = '';
    
    try {
      const params = new URLSearchParams({
        filename,
        length: fileSize.toString(),
        ...(title && { title })
      });

      const urlResponse = await fetch(`https://slack.com/api/files.getUploadURLExternal?${params}`, {
        method: 'GET',
        headers: {
          Authorization: this.botHeaders.Authorization
        }
      });

      // レスポンスのステータスをログに出力
      console.error(`Response status: ${urlResponse.status} ${urlResponse.statusText}`);
      
      // レスポンスの内容を取得
      const responseText = await urlResponse.text();
      console.error(`Response body: ${responseText}`);
      
      // JSONとして解析
      let urlData;
      try {
        urlData = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`JSON parse error: ${parseError}`);
        throw new Error(`Failed to parse response as JSON: ${responseText}`);
      }
      
      if (!urlData.ok) {
        const errorDetail = urlData.error || 'Unknown error';
        let errorMsg = `Slack API error: ${errorDetail}`;
        if (urlData.detail) {
          errorMsg += ` - ${urlData.detail}`;
        }
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      // 変数に値を代入
      upload_url = urlData.upload_url;
      file_id = urlData.file_id;

      // Step 2: Upload file to the temporary URL
      const uploadResponse = await fetch(upload_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: fileContent
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }
    } catch (error) {
      console.error('Fetch error details:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error occurred during fetch');
      }
      throw new Error(`Failed to get upload URL: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 3: Complete the upload process using files.completeUploadExternal
    const completeParams: any = {
      files: [{
        id: file_id,
        title: title || filename
      }],
      channel_id: channel_id
    };

    // Add thread_ts if provided
    if (thread_ts) {
      completeParams.thread_ts = thread_ts;
    }

    // Add initial comment if provided
    if (initial_comment) {
      completeParams.initial_comment = initial_comment;
    }

    const completeResponse = await fetch('https://slack.com/api/files.completeUploadExternal', {
      method: 'POST',
      headers: {
        Authorization: this.botHeaders.Authorization,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        files: JSON.stringify(completeParams.files),
        channel_id: completeParams.channel_id,
        ...(thread_ts && { thread_ts }),
        ...(initial_comment && { initial_comment })
      }).toString()
    });

    return completeResponse.json();
  }
}

async function main() {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const teamId = process.env.SLACK_TEAM_ID;

  if (!botToken || !teamId) {
    console.error(
      "Please set SLACK_BOT_TOKEN and SLACK_TEAM_ID environment variables",
    );
    process.exit(1);
  }

  console.error("Starting Slack MCP Server...");
  const server = new Server(
    {
      name: "Slack MCP Server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  const slackClient = new SlackClient(botToken);

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      console.error("Received CallToolRequest:", request);
      try {
        if (!request.params.arguments) {
          throw new Error("No arguments provided");
        }

        switch (request.params.name) {
          case "slack_list_channels": {
            const args = request.params
              .arguments as unknown as ListChannelsArgs;
            const response = await slackClient.getChannels(
              args.limit,
              args.cursor,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          case "slack_post_message": {
            const args = request.params.arguments as unknown as PostMessageArgs;
            if (!args.channel_id || !args.text) {
              throw new Error(
                "Missing required arguments: channel_id and text",
              );
            }
            const response = await slackClient.postMessage(
              args.channel_id,
              args.text,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          case "slack_reply_to_thread": {
            const args = request.params
              .arguments as unknown as ReplyToThreadArgs;
            if (!args.channel_id || !args.thread_ts || !args.text) {
              throw new Error(
                "Missing required arguments: channel_id, thread_ts, and text",
              );
            }
            const response = await slackClient.postReply(
              args.channel_id,
              args.thread_ts,
              args.text,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          case "slack_add_reaction": {
            const args = request.params.arguments as unknown as AddReactionArgs;
            if (!args.channel_id || !args.timestamp || !args.reaction) {
              throw new Error(
                "Missing required arguments: channel_id, timestamp, and reaction",
              );
            }
            const response = await slackClient.addReaction(
              args.channel_id,
              args.timestamp,
              args.reaction,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          case "slack_get_channel_history": {
            const args = request.params
              .arguments as unknown as GetChannelHistoryArgs;
            if (!args.channel_id) {
              throw new Error("Missing required argument: channel_id");
            }
            const response = await slackClient.getChannelHistory(
              args.channel_id,
              args.limit,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          case "slack_get_thread_replies": {
            const args = request.params
              .arguments as unknown as GetThreadRepliesArgs;
            if (!args.channel_id || !args.thread_ts) {
              throw new Error(
                "Missing required arguments: channel_id and thread_ts",
              );
            }
            const response = await slackClient.getThreadReplies(
              args.channel_id,
              args.thread_ts,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          case "slack_get_users": {
            const args = request.params.arguments as unknown as GetUsersArgs;
            const response = await slackClient.getUsers(
              args.limit,
              args.cursor,
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          case "slack_get_user_profile": {
            const args = request.params
              .arguments as unknown as GetUserProfileArgs;
            if (!args.user_id) {
              throw new Error("Missing required argument: user_id");
            }
            const response = await slackClient.getUserProfile(args.user_id);
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          case "slack_download_thread_files": {
            const args = request.params
              .arguments as unknown as DownloadThreadFilesArgs;
            if (!args.channel_id || !args.thread_ts || !args.output_folder) {
              throw new Error(
                "Missing required arguments: channel_id, thread_ts, and output_folder"
              );
            }
            const downloadedFiles = await slackClient.downloadThreadFiles(
              args.channel_id,
              args.thread_ts,
              args.output_folder
            );
            return {
              content: [{ type: "text", text: JSON.stringify(downloadedFiles) }],
            };
          }

          case "slack_upload_file_to_thread": {
            const args = request.params
              .arguments as unknown as UploadFileToThreadArgs;
            if (!args.channel_id || !args.thread_ts || !args.file_path) {
              throw new Error(
                "Missing required arguments: channel_id, thread_ts, and file_path"
              );
            }
            const response = await slackClient.uploadFileToThread(
              args.channel_id,
              args.thread_ts,
              args.file_path,
              args.title,
              args.initial_comment
            );
            return {
              content: [{ type: "text", text: JSON.stringify(response) }],
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error) {
        console.error("Error executing tool:", error);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            },
          ],
        };
      }
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("Received ListToolsRequest");
    return {
      tools: [
        listChannelsTool,
        postMessageTool,
        replyToThreadTool,
        addReactionTool,
        getChannelHistoryTool,
        getThreadRepliesTool,
        getUsersTool,
        getUserProfileTool,
        downloadThreadFilesTool,
        uploadFileToThreadTool,
      ],
    };
  });

  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  await server.connect(transport);

  console.error("Slack MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
