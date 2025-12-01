# TermoSlack - User-Based Slack Terminal Client

A terminal-based Slack client that allows you to use Slack **as yourself** (not as a bot), directly from your command line.

## Features

- ✅ **Acts as YOU** - All messages sent appear under your name, just like using Slack normally
- ✅ **Real-time messaging** - Receive messages instantly via RTM (Real-Time Messaging)
- ✅ **Channel/DM access** - See and interact with all channels and DMs you're a member of
- ✅ **Join Channels** - Search and join public channels directly from the UI
- ✅ **Image Viewing** - View images shared in channels (rendered as ASCII/ANSI art) or open them in your browser
- ✅ **Custom Themes** - Choose from 4 different color themes (Default, Hacker, Light, Ocean)
- ✅ **Custom Emojis** - View custom workspace emojis directly in the terminal
- ✅ **Full user permissions** - Send messages, react to posts, upload files, and more
- ✅ **Session persistence** - Login once and stay authenticated
- ✅ **Secure Logout** - Easily revoke your session and clear local data

## Setup Instructions

### 1. Create a Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name your app (e.g., "TermoSlack") and select your workspace
4. Click "Create App"

### 2. Configure OAuth & Permissions

1. In your app settings, go to **"OAuth & Permissions"**
2. Scroll down to **"Redirect URLs"**
3. Add: `http://localhost:3000/auth/callback` (or your custom OAUTH_REDIRECT_URI)
4. Click "Save URLs"

**Important:** You do **NOT** need to add Bot Token Scopes. This app uses **User Token Scopes** only.

### 3. Get Your Credentials

1. Go to **"Basic Information"** in your app settings
2. Under "App Credentials", find:
   - **Client ID**
   - **Client Secret**
3. Copy these values

### 4. Configure Environment

1. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   SLACK_CLIENT_ID=1234567890.1234567890123
   SLACK_CLIENT_SECRET=abc123def456ghi789jkl012mno345pq
   OAUTH_PORT=3000
   OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback
   ```

### 5. Install Dependencies

```powershell
npm install
```

### 6. Run the App

```powershell
node bootstrap.cjs
```

Or build an executable:

```powershell
npm run build:exe
.\termoslack.exe
```

## First-Time Authentication

1. Run the app
2. You'll see: `To authenticate, open: http://localhost:3000/login`
3. Open that URL in your browser
4. Slack will ask you to authorize the app - **click "Allow"**
5. You'll be redirected back and authenticated
6. The app will load all your channels and DMs

## Usage

- **Arrow Keys**: Navigate through channels/DMs
- **Enter**: Select a channel to view messages
- **Type & Enter**: Send a message to the selected channel
- **Ctrl+F**: Search for channels/DMs in the list
- **Ctrl+S**: Global message search
- **Ctrl+D**: Search for a user to DM
- **Ctrl+U**: Upload a file to the current channel
- **Ctrl+J / F7**: Join a new channel
- **Ctrl+T**: Cycle through color themes
- **Ctrl+Q**: Logout and exit
- **Ctrl+C**: Force exit
- **O**: Open selected image in browser
- **T**: View thread for selected message

## User Scopes Requested

The app requests these user scopes to function properly:

- `channels:read`, `channels:write`, `channels:history`, `channels:join` - Read, send, and join public channels
- `groups:read`, `groups:write`, `groups:history` - Read and send messages in private channels
- `mpim:read`, `mpim:write`, `mpim:history` - Group DMs
- `im:read`, `im:write`, `im:history` - Direct messages
- `chat:write` - Send messages as you
- `users:read` - See user names
- `files:read` - View files/images
- `search:read` - Search messages

All actions are performed **as you**, just like using the Slack web/desktop app.

## Troubleshooting

### "missing_scope" error
- Make sure you clicked "Allow" during OAuth authorization
- Try removing the saved session and re-authenticating:
  - Windows: Delete `%USERPROFILE%\.termoslack\sessions\*`
  - Then restart the app and login again

### "invalid_auth" error
- Your session may have expired
- Re-authenticate by opening the OAuth URL shown in the app

### Can't see channels
- Make sure you're a member of the channels you want to see
- The app only shows channels/DMs you're actually in (just like regular Slack)

## Building Executable

```powershell
npm run build:exe
```

This creates `termoslack.exe` that you can run anywhere without Node.js installed.

## Privacy & Security

- Your user token is stored locally in `~/.termoslack/sessions/`
- All communication goes directly between your computer and Slack's servers
- The app never sends your credentials or messages to any third party
- Your token grants the same access as your regular Slack session


