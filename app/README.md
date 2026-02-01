# OneMinute

A global anonymous real-time chat application where messages automatically disappear after 10 minutes.

**Live Demo:** https://arka-cmd.github.io/OneMinute/

## Features

- **No Login Required**: Open the site and start chatting immediately
- **Anonymous**: No usernames, no tracking, no cookies, no localStorage
- **Ephemeral Messages**: All messages disappear after exactly 10 minutes
- **Real-time**: WebSocket-powered instant message delivery
- **File Attachments**: Share files up to 1 MB with temporary links
- **Rate Limited**: 1 message per 3 seconds per user to prevent spam
- **Global**: Anyone in the world can join the same chat room

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         OneMinute Chat                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐         ┌─────────────────────────────┐ │
│  │   GitHub Pages      │         │    Render Free Web Service  │ │
│  │   (Static Hosting)  │◄───────►│    (WebSocket Backend)      │ │
│  │                     │   WSS   │                             │ │
│  │  • React + Vite     │         │  • Node.js + ws library     │ │
│  │  • TypeScript       │         │  • In-memory storage        │ │
│  │  • Tailwind CSS     │         │  • HTTP file upload         │ │
│  │  • No build step    │         │  • Auto-cleanup (TTL)       │ │
│  │    required on      │         │                             │ │
│  │    deploy           │         │                             │ │
│  └─────────────────────┘         └─────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Frontend (GitHub Pages)

The frontend is a **static React application** built with Vite and hosted on GitHub Pages:

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite (fast, modern bundler)
- **Styling**: Tailwind CSS
- **Deployment**: GitHub Pages (free, automatic from `gh-pages` branch)

**Why GitHub Pages?**
- 100% free for public repositories
- Automatic deployment via GitHub Actions
- CDN-powered global distribution
- No server maintenance required
- Perfect for static SPAs

### Backend (Render Free Web Service)

The backend is a **Node.js WebSocket server** running on Render's free tier:

- **Runtime**: Node.js 18+
- **WebSocket**: `ws` library (lightweight, fast)
- **HTTP Server**: Built-in Node.js `http` module
- **Storage**: In-memory only (no database)

**Why Render Free Web Service?**
- 100% free tier available
- Supports WebSocket connections
- No credit card required
- Automatic deployments from GitHub
- Sleeps after 15 min inactivity (free tier), wakes on request

### How Messages Auto-Delete

Messages are stored in memory with a **Time-To-Live (TTL)** of 10 minutes:

1. When a message is received, it's stored with a timestamp
2. A cleanup job runs every 30 seconds
3. Messages older than 10 minutes are automatically removed
4. When a new user connects, only non-expired messages are sent
5. The frontend also filters out expired messages client-side

```javascript
// TTL Logic
const MESSAGE_TTL = 10 * 60 * 1000; // 10 minutes

function cleanup() {
  const now = Date.now();
  for (const [id, msg] of messages.entries()) {
    if (now - msg.timestamp > MESSAGE_TTL) {
      messages.delete(id); // Gone forever
    }
  }
}
```

### File Upload System

Files are handled via HTTP endpoints:

1. Client converts file to base64 (client-side size check: 1 MB max)
2. POST to `/upload` endpoint
3. Server stores file in memory with timestamp
4. Returns temporary URL like `/files/<fileId>`
5. Files auto-delete after 10 minutes (same TTL as messages)
6. Download via GET `/files/<fileId>`

## Repository Structure

```
OneMinute/
└── app/
    ├── src/                  # React frontend source
    │   ├── components/       # React components
    │   ├── App.tsx          # Main application
    │   ├── main.tsx         # Entry point
    │   ├── types.ts         # TypeScript types
    │   └── index.css        # Global styles + Tailwind
    ├── dist/                 # Build output (GitHub Pages)
    ├── server.js             # Node.js WebSocket backend
    ├── package.json          # Dependencies & scripts
    ├── package-lock.json     # Locked dependencies
    ├── index.html            # HTML template
    ├── vite.config.ts        # Vite configuration
    ├── tsconfig.json         # TypeScript config
    ├── tailwind.config.js    # Tailwind CSS config
    ├── postcss.config.js     # PostCSS config
    └── README.md             # This file
```

## Deployment Guide

### Prerequisites

- GitHub account (free)
- Render account (free)

### Step 1: Push to GitHub

1. Create a new repository named `OneMinute` on GitHub
2. Push this code to the repository:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/arka-cmd/OneMinute.git
git push -u origin main
```

### Step 2: Deploy Backend on Render

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **"New +"** → **"Web Service"**
3. Connect your `OneMinute` repository
4. Configure the service:

| Setting | Value |
|---------|-------|
| Name | `oneminute-chat` (or any name) |
| Root Directory | `app` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Plan | `Free` |

5. Click **"Create Web Service"**
6. Wait for deployment to complete (2-3 minutes)
7. Note your service URL: `https://oneminute-chat.onrender.com`

### Step 3: Update WebSocket URL (if needed)

The code already uses `wss://oneminute-chat.onrender.com`. If you chose a different service name:

1. Edit `app/src/App.tsx`
2. Update these lines:

```typescript
const WS_URL = 'wss://YOUR-SERVICE-NAME.onrender.com';
const HTTP_URL = 'https://YOUR-SERVICE-NAME.onrender.com';
```

3. Also update in `app/src/components/ChatMessage.tsx`:

```typescript
href={`https://YOUR-SERVICE-NAME.onrender.com${message.fileUrl}`}
```

4. Commit and push:

```bash
git add .
git commit -m "Update WebSocket URL"
git push
```

### Step 4: Deploy Frontend on GitHub Pages

1. Go to your repository on GitHub
2. Click **"Settings"** → **"Pages"** (left sidebar)
3. Under **"Build and deployment"**:
   - Source: **"GitHub Actions"**
4. Create a workflow file at `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: cd app && npm ci

      - name: Build
        run: cd app && npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './app/dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

5. Commit and push the workflow file
6. Go to **"Actions"** tab to watch the deployment
7. Once complete, your site will be at: `https://arka-cmd.github.io/OneMinute/`

### Step 5: Verify Everything Works

1. Open `https://arka-cmd.github.io/OneMinute/`
2. You should see "Connected" in the header
3. Send a test message
4. Open in another browser/incognito to verify real-time sync
5. Wait 10 minutes to verify auto-deletion

## Local Development

### Run Backend Locally

```bash
cd app
npm install
npm start
```

Server runs on `http://localhost:3000`

### Run Frontend Locally

```bash
cd app
npm install
npm run dev
```

Vite dev server runs on `http://localhost:5173`

**Note**: For local development, update `App.tsx` to use `ws://localhost:3000` instead of the Render URL.

## Environment Variables

No environment variables are required for basic operation. The backend uses:

- `PORT`: Set by Render (defaults to 3000 locally)

## API Endpoints

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `init` | Server → Client | Initial messages on connection |
| `message` | Client → Server | Send a new message |
| `new_message` | Server → Client | New message broadcast |
| `ping` | Client → Server | Keep-alive ping |
| `pong` | Server → Client | Keep-alive response |
| `error` | Server → Client | Error message |

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/upload` | POST | Upload file (max 1 MB) |
| `/files/:id` | GET | Download file |

## Rate Limits

- **Messages**: 1 message per 3 seconds per socket
- **File uploads**: 1 MB maximum file size

## Security Considerations

- No authentication (by design)
- No persistent storage (messages are temporary)
- Files are stored in memory only
- No user tracking or analytics
- WebSocket connections are encrypted (WSS)

## Troubleshooting

### "Connecting..." stuck

1. Check if Render service is running (may be sleeping on free tier)
2. Verify WebSocket URL in `App.tsx`
3. Check browser console for errors

### Messages not appearing

1. Check network tab for WebSocket connection
2. Verify Render service logs
3. Check if rate limit is triggered

### File upload fails

1. Verify file is under 1 MB
2. Check browser console for errors
3. Verify Render service is not sleeping

## License

MIT License - Free to use, modify, and distribute.

## Support

For issues or questions, open an issue on GitHub.

---

**Built with ❤️ for the global anonymous chat community.**
