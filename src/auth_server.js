import express from "express";
import open from "open";
import { config } from "./config.js";
import { WebClient } from "@slack/web-api";

export function createAuthServer(onSuccess) {
    const app = express();
    const port = config.oauthPort;

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

    app.get("/",(req,res)=>{
        res.send("TermoSlack OAuth Server. Use /login to start the OAuth flow.");
    });

    app.get("/login", (req, res) => {
        const redirect = `https://slack.com/oauth/v2/authorize?client_id=${config.clientId}&scope=${encodeURIComponent(scopes)}&user_scope=${encodeURIComponent("")}&redirect_uri=${encodeURIComponent(`http://localhost:${port}/auth/callback`)}`;
        open(redirect);
        res.send(`Opened browser for Slack login. If not, open this URL:\n\n${redirect}`);
    });
    
    app.get("/auth/callback", async (req, res) => {
        const code = req.query.code;
        if (!code) {
            res.status(400).send("Missing code parameter");
            return;
        }
        try{
            const web = new WebClient();
            const result = await web.oauth.v2.access({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code,
                redirect_uri: `http://localhost:${port}/auth/callback`
            });
        
        await onToken(result);
        res.send("<h3>Authorization Successfull, Redirect to App</h3>")
        } catch (err) {
            console.error("OAuth Error:", err);
            res.status(500).send("OAuth Error: " + String(err.message || err));
        }
    });
    
    const server = app.listen(port, () => {
        console.log(`OAuth server listening at http://localhost:${port}`);
});

    return {
        url: "http://localhost:${port}",
        close: () => server.close(),
        logiUrl: () => `http://localhost:${port}/login`
    };
}