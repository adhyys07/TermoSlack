import express from 'express';
import { WebClient } from '@slack/web-api';
import ngrok from '@ngrok/ngrok';
import open from 'open';
import { config } from './config.js';
import { logInfo, logError } from './logger.js';

const app = express();
let authServer = null;
const userScopes = [
        "channels:read",
        "channels:write",
        "channels:history",
        "chat:write",
        "users:read",
        "groups:read",
        "groups:write",
        "groups:history",
        "mpim:read",
        "mpim:write",
        "mpim:history",
        "im:read",
        "im:write",
        "im:history",
        "files:read",
        "files:write",
        "reactions:read",
        "reactions:write",
        "search:read",
        "emoji:read",
        "usergroups:read"
].join(',');

export function createAuthServer(onSuccess) {
  const PORT = 3000;
  
  // Get static domain from env or use default
  const ngrokDomain = process.env.NGROK_DOMAIN || 'termoslack.ngrok.app';
  const publicUrl = `https://${ngrokDomain}`;

  app.get('/auth/slack', (req, res) => {
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.clientId}&user_scope=${userScopes}&redirect_uri=${publicUrl}/auth/callback`;
    logInfo('Redirecting to Slack OAuth');
    res.redirect(authUrl);
  });

  app.get('/auth/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
      logError(`OAuth error: ${error}`);
      res.send(`Authentication failed: ${error}`);
      return;
    }

    try {
      const client = new WebClient();
      const result = await client.oauth.v2.access({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: `${publicUrl}/auth/callback`
      });

      const userToken = result.authed_user.access_token;
      const userId = result.authed_user.id;
      const teamId = result.team.id;

      logInfo(`OAuth successful for user ${userId}`);

      res.send(`
        <html>
          <head>
            <style>
              body { 
                font-family: Arial; 
                text-align: center; 
                padding: 50px; 
                background: #f8f9fa;
              }
              .success { 
                background: white; 
                padding: 30px; 
                border-radius: 10px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 500px;
                margin: 0 auto;
              }
              h1 { color: #2eb886; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <div class="success">
              <h1>✅ Authentication Successful!</h1>
              <p>You can close this window and return to TermoSlack.</p>
            </div>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);

      onSuccess({
        userToken,
        userId,
        teamId,
        result
      });
      
      // Close server after successful auth
      setTimeout(() => {
        if (authServer) {
          authServer.close();
          logInfo('Auth server closed after successful authentication');
        }
      }, 5000);

    } catch (err) {
      logError('OAuth token exchange failed', err);
      res.send(`Authentication failed: ${err.message}`);
    }
  });

  authServer = app.listen(PORT, () => {
    logInfo(`Local server running on port ${PORT}`);
    
    // Connect to ngrok in a separate async function
    (async () => {
      try {
        // Connect to ngrok with static domain
        await ngrok.connect({
          addr: PORT,
          authtoken: process.env.NGROK_AUTHTOKEN,
          domain: ngrokDomain,
        });

        logInfo(`ngrok tunnel established at ${publicUrl}`);
        console.log(`\n🔗 To authenticate, open: ${publicUrl}/auth/slack\n`);
        
        // Auto-open browser
        await open(`${publicUrl}/auth/slack`);
        
      } catch (error) {
        logError('Failed to start ngrok tunnel', error);
        console.error('\n❌ Failed to create ngrok tunnel. Make sure:');
        console.error('1. You have an ngrok account');
        console.error('2. NGROK_AUTHTOKEN is set in .env');
        console.error('3. Your static domain is configured correctly\n');
        console.error(`Error details: ${error.message}\n`);
      }
    })();
  });

  return authServer;
}

export function getAuthUrl() {
  const ngrokDomain = process.env.NGROK_DOMAIN || 'termoslack.ngrok.app';
  return `https://${ngrokDomain}/auth/slack`;
}