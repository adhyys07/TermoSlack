import { createUI, setChannels } from './ui.js';
import { createAuthServer } from './auth_server.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { saveSession, loadSession, listSessions } from './storage.js';
import { initUserClient } from './user_client.js';
import { logInfo, logError, logWarn } from './logger.js';

async function main() {
  // Load .env from the runtime directory (works when running node or a packaged exe)
  let __filename, __dirname, runtimeDir;
  
  if (process.pkg) {
    // Running as packaged executable
    __filename = process.execPath;
    __dirname = path.dirname(__filename);
    runtimeDir = __dirname;
  } else {
    // Running with Node.js
    __filename = fileURLToPath(import.meta.url);
    __dirname = path.dirname(__filename);
    runtimeDir = __dirname;
  }
  
  try {
    dotenv.config({ path: path.resolve(runtimeDir, '..', '.env') });
  } catch (e) {
    console.error('Failed to load .env:', e);
  }

  // Log startup
  logInfo('TermoSlack starting...');
  logInfo(`Runtime directory: ${runtimeDir}`);

  let currentUserSession = null;
  
  // Create UI first
  createUI();

  // OAuth callback handler
  const auth = createAuthServer(async (oauthResult) => {
    logInfo('OAuth callback received');
    
    if (!oauthResult.userToken || !oauthResult.teamId || !oauthResult.userId) {
      logError('OAuth success but missing required fields');
      return;
    }

    const teamName = (oauthResult.result && oauthResult.result.team && oauthResult.result.team.name) || "(unknown)";
    logInfo(`User authenticated: ${oauthResult.userId} in workspace ${teamName}`);
    
    saveSession(oauthResult.teamId, oauthResult.userId, { 
      userToken: oauthResult.userToken, 
      teamName 
    });
    
    // Initialize user client
    initUserClient(oauthResult.userToken);
    currentUserSession = {
      userToken: oauthResult.userToken,
      teamId: oauthResult.teamId,
      userId: oauthResult.userId,
      teamName
    };

    // Load user's channels
    await loadUserChannels();
    logInfo('User authenticated and channels loaded');
  });

  console.log(`\nTo authenticate, open: ${auth.loginUrl()}\n`);

  // Check for existing session
  const sessionList = listSessions();
  if (sessionList.length > 0) {
    logInfo(`Found ${sessionList.length} saved session(s)`);
    const sessionKey = sessionList[0];
    const [teamId, userId] = sessionKey.split('_');
    const session = loadSession(teamId, userId);
    
    if (session && session.userToken) {
      try {
        logInfo('Attempting to restore session');
        initUserClient(session.userToken);
        currentUserSession = session;
        currentUserSession.userId = userId;
        currentUserSession.teamId = teamId;

        // Load channels and start UI
        await loadUserChannels();
        logInfo('Session restored and channels loaded');
      } catch (e) {
        logWarn('Saved session is invalid or expired');
        logError('Session restore error', e);
        console.log(`Saved session is invalid or expired. Please re-authenticate.`);
        console.log(`OAuth URL: ${auth.loginUrl()}`);
      }
    }
  } else {
    logInfo('No saved sessions found');
    console.log("No saved sessions found. Please authenticate using the URL above.");
  }

  // Load user's channels
  async function loadUserChannels() {
    try {
      logInfo('Loading channels');
      const { loadUserChannels: loadChannelsFunc, loadDMUserNames } = await import('./user_client.js');
      const { updateStatus } = await import('./ui.js');
      
      const channelData = await loadChannelsFunc();
      
      if (channelData && channelData.length > 0) {
        // Separate DMs and channels
        const dms = channelData.filter(ch => ch.is_im);
        const channels = channelData.filter(ch => !ch.is_im);
        
        // Sort DMs by last message time (most recent first) and take only top 25
        dms.sort((a, b) => {
          const timeA = a.lastMessageTime || 0;
          const timeB = b.lastMessageTime || 0;
          return timeB - timeA; // Descending order (newest first)
        });
        const recentDMs = dms.slice(0, 25);
        
        logInfo(`Found ${dms.length} DMs, showing top 25 recent`);
        
        // Map DMs first (preserve recency order)
        const mappedDMs = recentDMs.map(ch => ({
          id: ch.id,
          name: ch.displayName || ch.name || ch.id,
          type: 'dm',
          is_private: false,
          originalChannel: ch,
          lastMessageTime: ch.lastMessageTime || 0
        }));
        
        // Map channels and sort alphabetically
        const mappedChannelsOnly = channels.map(ch => ({
          id: ch.id,
          name: ch.name || ch.id,
          type: 'channel',
          is_private: ch.is_private || false,
          originalChannel: ch
        }));
        mappedChannelsOnly.sort((a, b) => a.name.localeCompare(b.name));
        
        // Combine: channels first (sorted), then DMs (in recency order)
        const mappedChannels = [...mappedChannelsOnly, ...mappedDMs];
        
        setChannels(mappedChannels);
        logInfo(`Loaded ${mappedChannels.length} channels/DMs`);
        
        // Load DM user names in background (only for the 25 recent DMs)
        if (recentDMs.length > 0) {
          updateStatus(`Loading ${recentDMs.length} DM users...`);
          
          // Run in background
          loadDMUserNames(recentDMs, (processed, total) => {
            updateStatus(`Loading DM users: ${processed}/${total}`);
          }).then(updatedDMs => {
            // Update with real user names - preserve recency order
            const updatedMappedDMs = updatedDMs.map(dm => ({
              id: dm.id,
              name: dm.displayName || dm.name || dm.id,
              type: 'dm',
              is_private: false,
              originalChannel: dm,
              lastMessageTime: dm.lastMessageTime || 0
            }));
            
            // Recreate channels list (channels sorted alphabetically, DMs in recency order)
            const updatedMapped = [...mappedChannelsOnly, ...updatedMappedDMs];
            
            setChannels(updatedMapped);
            updateStatus('Ready');
            logInfo('DM user names loaded');
          }).catch(err => {
            logError('Failed to load DM user names', err);
            updateStatus('Ready (DM names not loaded)');
          });
        }
      }
    } catch (e) {
      logError('Failed to load channels', e);
      console.error(`Failed to load channels: ${e.message}`);
    }
  }
}

main();
