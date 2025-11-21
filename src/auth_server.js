import express from "express";
import open from "open";
import { config } from "./config.js";
import { WebClient } from "@slack/web-api";
import fs from "fs";
import path from "path";

function escapeHtml(s) { 
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); 
}
function handleSlackApiError(err, ui) {
    if (!err || !err.data) return false;
    const data = err.data;
    if (data.error === "missing_scope" || data.error === "missing_required_scope") {
        const needed = data.needed || (data.response_metadata && data.response_metadata.scopes && data.response_metadata.scopes.join(',')) || '';
        const provided = data.provided || '';
        ui.log(chalk.red(`Slack API missing_scope error — needed: ${needed || '(unknown)'}; provided: ${provided || '(none)'}`));
        ui.log(chalk.yellow("Fix: In your Slack App → OAuth & Permissions add the missing Bot Token Scopes above, then click 'Install App' → 'Reinstall to Workspace'. After reinstall, update SLACK_BOT_TOKEN in .env and restart the app."));
        return true;
    }
    return false;
}

export function createAuthServer(onSuccess) {
    const app = express();
    const port = config.oauthPort;

    const redirectUri = process.env.OAUTH_REDIRECT_URI || config.redirectUri || `http://localhost:${port}/auth/callback`;

    const botScopes = [
        "chat:write",
        "channels:read",
        "channels:history",
        "groups:read",
        "groups:history",
        "mpim:read",
        "mpim:history",
        "im:read",
        "im:history",
        "im:write",
        "files:write",
        "reactions:write",
        "users:read"
    ].join(" ");

    // sanitize user scopes from env/config: remove surrounding quotes and collapse whitespace
    let userScopes = process.env.OAUTH_USER_SCOPES || config.userScopes || "";
    if (typeof userScopes === 'string') {
        userScopes = userScopes.replace(/^"+|"+$/g, '').trim().replace(/\s+/g, ' ');
    } else {
        userScopes = '';
    }

    console.log("OAuth redirect URI:", redirectUri);
    console.log("OAuth scopes requested:", botScopes);
    console.log("User OAuth scopes requested:", userScopes);

    app.get("/",(req,res)=>{
        res.send("TermoSlack OAuth Server. Use /login to start the OAuth flow.");
    });

    app.get("/login", (req, res) => {
        let redirect = `https://slack.com/oauth/v2/authorize?client_id=${config.clientId}` +
            `&scope=${encodeURIComponent(botScopes)}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}`;
        if (userScopes && userScopes.trim()) redirect += `&user_scope=${encodeURIComponent(userScopes)}`;
        open(redirect);
        res.send(`Opened browser for Slack login. If not, open this URL:\n\n${redirect}`);
    });
    
    app.get("/auth/callback", async (req, res) => {
        console.log("OAuth callback received. Query params:", JSON.stringify(req.query, null, 2));
        
        if (req.query.error) {
            const errorDetails = {
                error: req.query.error,
                error_description: req.query.error_description || 'No description provided',
                full_query: req.query
            };
            console.error("OAuth authorization error from Slack:", JSON.stringify(errorDetails, null, 2));
            
            try { 
                fs.appendFileSync(
                    path.resolve(process.cwd(), 'oauth_error.log'), 
                    `${new Date().toISOString()} OAuth authorization error:\n${JSON.stringify(errorDetails, null, 2)}\n\n`
                ); 
            } catch(e) { 
                console.error("Failed writing oauth_error.log", e); 
            }
            
            res.status(400).send(`
                <h3>OAuth Authorization Error</h3>
                <p><strong>Error:</strong> ${escapeHtml(errorDetails.error)}</p>
                <p><strong>Description:</strong> ${escapeHtml(errorDetails.error_description)}</p>
                <pre>${escapeHtml(JSON.stringify(errorDetails, null, 2))}</pre>
                <p><a href="/">Return to OAuth server</a></p>
            `);
            return;
        }

        const code = req.query.code;
        if (!code) {
            res.status(400).send("Missing code parameter");
            return;
        }
        
        try{
            const web = new WebClient();
            console.log("Exchanging OAuth code for tokens...");
            const result = await web.oauth.v2.access({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code,
                redirect_uri: redirectUri
            });

            console.log("OAuth token exchange result:", JSON.stringify(result, null, 2));
            try { 
                fs.appendFileSync(
                    path.resolve(process.cwd(), 'oauth_error.log'), 
                    `${new Date().toISOString()} OAuth success:\n${JSON.stringify(result, null, 2)}\n\n`
                ); 
            } catch(e) {}

            // normalize returned tokens and ids
            const botToken = result.access_token || null;
            const authedUser = result.authed_user || null;
            const userToken = authedUser ? authedUser.access_token : null;
            const teamId = (result.team && result.team.id) || result.team_id || null;

            if (!botToken) console.warn('OAuth: no bot token in response');
            if (!userToken) console.warn('OAuth: no user token returned (user scopes may not have been granted)');
            if (!teamId) console.warn('OAuth: no team id returned');

            // call the provided success handler with normalized data
            await onSuccess({ result, botToken, userToken, teamId });
            res.send("<h3>Authorization Successful, return to the app</h3>")
        } catch (err) {
            // Detailed error logging for token exchange failures
            const errorDetails = {
                message: err.message,
                code: err.code,
                data: err.data,
                body: err.body,
                stack: err.stack
            };
            console.error("OAuth token exchange error:", JSON.stringify(errorDetails, null, 2));
            
            try { 
                fs.appendFileSync(
                    path.resolve(process.cwd(), 'oauth_error.log'), 
                    `${new Date().toISOString()} OAuth token exchange error:\n${JSON.stringify(errorDetails, null, 2)}\n\n`
                ); 
            } catch(e) { 
                console.error("Failed writing oauth_error.log", e); 
            }
            
            res.status(500).send(`
                <h3>OAuth Token Exchange Error</h3>
                <p><strong>Message:</strong> ${escapeHtml(err.message || 'Unknown error')}</p>
                <pre>${escapeHtml(JSON.stringify(errorDetails, null, 2))}</pre>
                <p><a href="/">Return to OAuth server</a></p>
            `);
        }
    });
    
    const server = app.listen(port, () => {
        console.log(`OAuth server listening at ${redirectUri.replace(/\/auth\/callback$/, '')}`);
    });

    return {
        url: redirectUri.replace(/\/auth\/callback$/, ''),
        close: () => server.close(),
        loginUrl: () => `${redirectUri.replace(/\/auth\/callback$/, '')}/login`
    };
}