import { WebClient } from "@slack/web-api";
import { logInfo, logError } from "./logger.js";

let userClient = null;

export function initUserClient(token) {
    userClient = new WebClient(token);
    return userClient;
}

export function getUserClient() {
    return userClient;
}

export function getUserToken(){
    return userClient?.token;
}

export function makeUserClient(userToken) {
    return new WebClient(userToken);
}

export async function sendMessageAsUser(userToken, channel, text) {
    const client = makeUserClient(userToken);
    return client.chat.postMessage({channel, text});
}

export async function sendMessage(channelId, text) {
    try {
        if (!userClient) {
            throw new Error('User client not initialized');
    }
        const result = await userClient.chat.postMessage({
            channel: channelId,
            text: text
    });
        logInfo(`Message sent to ${channelId}`);
        return result;
}       catch (error) {
        logError(`Error sending message to ${channelId}: ${error.message}`);
        throw error;
}
}


export async function loadMessages(channelId, limit = 20, oldest = undefined) {
  try {
    if (!userClient) {
      throw new Error('User client not initialized');
    }

    const params = {
      channel: channelId,
      limit: limit
    };
    
    // If oldest is provided, get messages before that timestamp
    if (oldest) {
      params.latest = oldest;
    }

    const result = await userClient.conversations.history(params);

    // Get user names for messages and detect images
    const messagesWithNames = await Promise.all(
      result.messages.map(async (msg) => {
        let userName = 'Unknown';
        
        if (msg.user) {
          try {
            const userInfo = await userClient.users.info({ user: msg.user });
            userName = userInfo.user.profile?.display_name || userInfo.user.real_name || userInfo.user.name;
          } catch (error) {
            userName = msg.user;
          }
        } else {
          userName = msg.username || 'Unknown';
        }

        // Replace user mentions in message text with usernames
        let messageText = msg.text || '';
        if (messageText.includes('<@')) {
          const userMentions = messageText.match(/<@([A-Z0-9]+)>/g);
          if (userMentions) {
            for (const mention of userMentions) {
              const userId = mention.match(/<@([A-Z0-9]+)>/)[1];
              try {
                const mentionedUserInfo = await userClient.users.info({ user: userId });
                const mentionedName = mentionedUserInfo.user.profile?.display_name || 
                                     mentionedUserInfo.user.real_name || 
                                     mentionedUserInfo.user.name;
                messageText = messageText.replace(mention, `@${mentionedName}`);
              } catch (error) {
                // Keep original if user info fetch fails
                messageText = messageText.replace(mention, `@${userId}`);
              }
            }
          }
        }

        // Check if message has files/images
        const hasImages = msg.files && msg.files.length > 0 && 
                         msg.files.some(f => f.mimetype?.startsWith('image/'));
        
        const imageFiles = hasImages ? msg.files.filter(f => f.mimetype?.startsWith('image/')) : [];

        return {
          ...msg,
          text: messageText,
          user_name: userName,
          has_images: hasImages,
          image_files: imageFiles
        };
      })
    );

    logInfo(`Loaded ${messagesWithNames.length} messages from channel ${channelId}`);
    return messagesWithNames;
  } catch (error) {
    logError(`Failed to load messages from channel ${channelId}`, error);
    throw error;
  }
}


export async function getUserChannels(userToken) {
    const client = makeUserClient(userToken);
    const res = await client.conversations.list({limit:200});
    return res.channels || [];
}

export async function getUserName(userToken, userId) {
    const client = makeUserClient(userToken);
    const res = await client.users.info({user: userId});
    return (res.user && (res.user.real_name || res.user.name)) || "Unknown";
}

export async function joinChannel(channelName) {
    if (!userClient) {
        throw new Error('User client not initialized');
    }

    try {
        // Remove # prefix if user included it
        const cleanChannelName = channelName.startsWith('#') ? channelName.slice(1) : channelName;
        
        // Join the channel
        const result = await userClient.conversations.join({
            channel: cleanChannelName
        });
        
        return {
            success: true,
            channel: result.channel
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

export async function loadUserChannels() {
    if (!userClient) {
        throw new Error('User client not initialized');
    }

    try {
        // Load all conversation types (channels and DMs only, no groups)
        const result = await userClient.users.conversations({
            types: "public_channel,private_channel,im",
            exclude_archived: true,
            limit: 1000
        });

        if (!result.ok || !result.channels) {
            return [];
        }

        // Process channels and extract last message timestamp from latest field
        const processedChannels = result.channels.map((channel) => {
            // For DMs, use user ID (no user name fetching)
            if (channel.is_im) {
                // Get the actual last message timestamp
                const lastMessageTime = channel.latest ? parseFloat(channel.latest.ts) : 0;
                return {
                    ...channel,
                    displayName: channel.user || channel.id,
                    name: channel.user || channel.id,
                    lastMessageTime: lastMessageTime
                };
            }
            // For regular channels
            else {
                return {
                    ...channel,
                    displayName: channel.name || channel.id,
                    name: channel.name || channel.id
                };
            }
        });

        return processedChannels;
    } catch (error) {
        console.error('Error loading user channels:', error);
        throw error;
    }
}

export async function loadDMUserNames(channels, onProgress) {
    if (!userClient) {
        throw new Error('User client not initialized');
    }

    try {
        // Collect all unique user IDs from DMs
        const userIds = new Set();
        channels.forEach(channel => {
            if (channel.is_im && channel.user) {
                userIds.add(channel.user);
            }
        });

        if (userIds.size === 0) {
            return channels;
        }

        // Batch fetch user info with controlled concurrency  
        const userMap = new Map();
        const userIdArray = Array.from(userIds);
        const batchSize = 10; // Process 10 users at a time
        let processed = 0;
        
        for (let i = 0; i < userIdArray.length; i += batchSize) {
            const batch = userIdArray.slice(i, i + batchSize);
            
            // Fetch batch in parallel
            const results = await Promise.allSettled(
                batch.map(async (userId) => {
                    const userInfo = await userClient.users.info({ user: userId });
                    if (userInfo.ok && userInfo.user) {
                        return {
                            userId,
                            name: userInfo.user.real_name || userInfo.user.name || userId
                        };
                    }
                    return { userId, name: userId };
                })
            );
            
            // Store successful results
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    userMap.set(result.value.userId, result.value.name);
                }
            });
            
            processed += batch.length;
            
            // Report progress
            if (onProgress) {
                onProgress(processed, userIdArray.length);
            }
            
            // Small delay between batches to respect rate limits
            if (i + batchSize < userIdArray.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // Update channels with user names
        const updatedChannels = channels.map(channel => {
            if (channel.is_im && channel.user) {
                const userName = userMap.get(channel.user) || channel.user || channel.id;
                return {
                    ...channel,
                    displayName: userName,
                    name: userName
                };
            }
            return channel;
        });

        return updatedChannels;
    } catch (error) {
        console.error('Error loading DM user names:', error);
        return channels; // Return original channels on error
    }
}

