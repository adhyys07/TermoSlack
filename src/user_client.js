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

export async function sendMessage(channelId, text, threadTs = null) {
    try {
        if (!userClient) {
            throw new Error('User client not initialized');
    }
        const messageOptions = {
            channel: channelId,
            text: text
        };
        
        // If threadTs is provided, send as a thread reply
        if (threadTs) {
            messageOptions.thread_ts = threadTs;
        }
        
        const result = await userClient.chat.postMessage(messageOptions);
        logInfo(`Message sent to ${channelId}${threadTs ? ' (in thread)' : ''}`);
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
        
        // Replace user mentions
        if (messageText.includes('<@')) {
          const userMentions = messageText.match(/<@[A-Z0-9]+(\|[^>]+)?>/g);
          if (userMentions) {
            for (const mention of userMentions) {
              const userId = mention.match(/<@([A-Z0-9]+)/)[1];
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

        // Replace channel mentions with channel names
        if (messageText.includes('<#')) {
          const channelMentions = messageText.match(/<#[C][A-Z0-9]+(\|[^>]+)?>/g);
          if (channelMentions) {
            for (const mention of channelMentions) {
              // Check if channel name is already in the mention (format: <#C123|channel-name>)
              const pipeMatch = mention.match(/<#[C][A-Z0-9]+\|([^>]+)>/);
              if (pipeMatch) {
                // Use the name from the pipe format
                const channelName = pipeMatch[1];
                messageText = messageText.replace(mention, `#${channelName}`);
              } else {
                // Fetch channel name from API
                const channelId = mention.match(/<#([C][A-Z0-9]+)/)[1];
                try {
                  const channelInfo = await userClient.conversations.info({ channel: channelId });
                  const channelName = channelInfo.channel.name;
                  messageText = messageText.replace(mention, `#${channelName}`);
                } catch (error) {
                  // Keep original if channel info fetch fails
                  logError(`Failed to resolve channel ${channelId}`, error);
                  messageText = messageText.replace(mention, `#${channelId}`);
                }
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

export async function loadThreadReplies(channelId, threadTs) {
  try {
    if (!userClient) {
      throw new Error('User client not initialized');
    }

    const result = await userClient.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 100
    });

    // Process replies with user names
    const repliesWithNames = await Promise.all(
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

        // Replace mentions in text
        let messageText = msg.text || '';
        
        // Replace user mentions
        if (messageText.includes('<@')) {
          const userMentions = messageText.match(/<@[A-Z0-9]+(\|[^>]+)?>/g);
          if (userMentions) {
            for (const mention of userMentions) {
              const userId = mention.match(/<@([A-Z0-9]+)/)[1];
              try {
                const mentionedUserInfo = await userClient.users.info({ user: userId });
                const mentionedName = mentionedUserInfo.user.profile?.display_name || 
                                     mentionedUserInfo.user.real_name || 
                                     mentionedUserInfo.user.name;
                messageText = messageText.replace(mention, `@${mentionedName}`);
              } catch (error) {
                messageText = messageText.replace(mention, `@${userId}`);
              }
            }
          }
        }

        // Replace channel mentions
        if (messageText.includes('<#')) {
          const channelMentions = messageText.match(/<#[C][A-Z0-9]+(\|[^>]+)?>/g);
          if (channelMentions) {
            for (const mention of channelMentions) {
              const pipeMatch = mention.match(/<#[C][A-Z0-9]+\|([^>]+)>/);
              if (pipeMatch) {
                const channelName = pipeMatch[1];
                messageText = messageText.replace(mention, `#${channelName}`);
              } else {
                const channelId = mention.match(/<#([C][A-Z0-9]+)/)[1];
                try {
                  const channelInfo = await userClient.conversations.info({ channel: channelId });
                  const channelName = channelInfo.channel.name;
                  messageText = messageText.replace(mention, `#${channelName}`);
                } catch (error) {
                  logError(`Failed to resolve channel ${channelId}`, error);
                  messageText = messageText.replace(mention, `#${channelId}`);
                }
              }
            }
          }
        }

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

    logInfo(`Loaded ${repliesWithNames.length} thread replies`);
    return repliesWithNames;
  } catch (error) {
    logError(`Failed to load thread replies`, error);
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

export async function searchMessages(query, options = {}) {
  try {
    if (!userClient) {
      throw new Error('User client not initialized');
    }

    logInfo(`Searching for: "${query}"`);

    const searchOptions = {
      query: query,
      sort: options.sort || 'timestamp',
      sort_dir: options.sortDir || 'desc',
      count: options.count || 100
    };

    if (options.page) {
      searchOptions.page = options.page;
    }

    const result = await userClient.search.messages(searchOptions);

    // Process search results with user names and channel info
    const processedMatches = await Promise.all(
      result.messages.matches.map(async (match) => {
        let userName = 'Unknown';
        let channelName = 'Unknown';

        // Get user name
        if (match.user) {
          try {
            const userInfo = await userClient.users.info({ user: match.user });
            userName = userInfo.user.profile?.display_name || userInfo.user.real_name || userInfo.user.name;
          } catch (error) {
            userName = match.username || match.user;
          }
        }

        // Get channel name
        if (match.channel?.id) {
          try {
            const channelInfo = await userClient.conversations.info({ channel: match.channel.id });
            channelName = channelInfo.channel.name || match.channel.name;
          } catch (error) {
            channelName = match.channel.name || match.channel.id;
          }
        }

        // Replace user mentions in text
        let messageText = match.text || '';
        const mentionRegex = /<@[A-Z0-9]+(\|[^>]+)?>/g;
        const mentions = messageText.match(mentionRegex);
        
        if (mentions) {
          for (const mention of mentions) {
            const userId = mention.match(/<@([A-Z0-9]+)/)[1];
            try {
              const userInfo = await userClient.users.info({ user: userId });
              const displayName = userInfo.user.profile?.display_name || userInfo.user.real_name || userInfo.user.name;
              messageText = messageText.replace(mention, `@${displayName}`);
            } catch (err) {
              // Keep original mention if user lookup fails
            }
          }
        }

        // Replace channel mentions in text
        const channelMentionRegex = /<#[C][A-Z0-9]+(\|[^>]+)?>/g;
        const channelMentions = messageText.match(channelMentionRegex);
        
        if (channelMentions) {
          for (const mention of channelMentions) {
            // Check if channel name is already in the mention (format: <#C123|channel-name>)
            const pipeMatch = mention.match(/<#[C][A-Z0-9]+\|([^>]+)>/);
            if (pipeMatch) {
              // Use the name from the pipe format
              const channelName = pipeMatch[1];
              messageText = messageText.replace(mention, `#${channelName}`);
            } else {
              // Fetch channel name from API
              const channelId = mention.match(/<#([C][A-Z0-9]+)/)[1];
              try {
                const channelInfo = await userClient.conversations.info({ channel: channelId });
                const chName = channelInfo.channel.name;
                messageText = messageText.replace(mention, `#${chName}`);
              } catch (err) {
                // Keep original mention if channel lookup fails
                logError(`Failed to resolve channel ${channelId} in search`, err);
              }
            }
          }
        }

        // Check if message has files/images
        const hasImages = match.files && match.files.length > 0 && 
                         match.files.some(f => f.mimetype?.startsWith('image/'));
        
        const imageFiles = hasImages ? match.files.filter(f => f.mimetype?.startsWith('image/')) : [];

        return {
          ...match,
          text: messageText,
          user_name: userName,
          channel_name: channelName,
          channel_id: match.channel?.id,
          has_images: hasImages,
          image_files: imageFiles,
          permalink: match.permalink
        };
      })
    );

    logInfo(`Found ${processedMatches.length} results for "${query}"`);

    return {
      matches: processedMatches,
      total: result.messages.total,
      page: result.messages.pagination?.page || 1,
      page_count: result.messages.pagination?.page_count || 1
    };
  } catch (error) {
    logError(`Failed to search messages for "${query}"`, error);
    throw error;
  }
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

