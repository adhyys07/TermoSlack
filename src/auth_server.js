import express from "express";
import open from "open";
import { config } from "./config.js";
import { WebClient } from "@slack/web-api";
import fs from "fs";
import path from "path";

function escapeHtml(s) { 
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); 
}

export function createAuthServer(onSuccess) {
    const app = express();
    const port = config.oauthPort;

    // Use env override or fallback to ngrok/localhost
    const redirectUri = process.env.OAUTH_REDIRECT_URI || config.redirectUri || `http://localhost:${port}/auth/callback`;

    const scopes = [
        "channels:read",
        "channels:history",
        "chat:write",
        "im:history",
        "im:write",
        "files:write",
        "users:read",
        "reactions:write",
        "search:read"
    ].join(",");

    console.log("OAuth redirect URI:", redirectUri);
    console.log("OAuth scopes requested:", scopes);

    app.get("/",(req,res)=>{
        res.send("TermoSlack OAuth Server. Use /login to start the OAuth flow.");
    });

    app.get("/login", (req, res) => {
        const redirect = `https://slack.com/oauth/v2/authorize?client_id=${config.clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        open(redirect);
        res.send(`Opened browser for Slack login. If not, open this URL:\n\n${redirect}`);
    });
    
    app.get("/auth/callback", async (req, res) => {
        console.log("OAuth callback received. Query params:", JSON.stringify(req.query, null, 2));
        
        // Check if Slack returned an error (e.g., user denied or invalid_scope during authorization)
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
            
            console.log("OAuth token exchange successful");
            try { 
                fs.appendFileSync(
                    path.resolve(process.cwd(), 'oauth_error.log'), 
                    `${new Date().toISOString()} OAuth success:\n${JSON.stringify(result, null, 2)}\n\n`
                ); 
            } catch(e) {}
        
            // call the provided success handler with the oauth result
            await onSuccess(result);
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
        console.log(`OAuth server listening at http://localhost:${port}`);
    });

    return {
        url: `http://localhost:${port}`,
        close: () => server.close(),
        loginUrl: () => `http://localhost:${port}/login`
    };
}