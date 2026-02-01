import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const MESSAGE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
const RATE_LIMIT_WINDOW = 3000; // 3 seconds
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

// In-memory storage
const messages = new Map(); // messageId -> { id, text, timestamp, fileUrl?, fileName? }
const files = new Map(); // fileId -> { data, mimeType, timestamp, fileName }
const rateLimits = new Map(); // socketId -> lastMessageTime

let messageIdCounter = 0;
let fileIdCounter = 0;

// Generate unique IDs
function generateMessageId() {
  return `msg_${Date.now()}_${++messageIdCounter}`;
}

function generateFileId() {
  return `file_${Date.now()}_${++fileIdCounter}`;
}

// Clean up expired messages and files
function cleanup() {
  const now = Date.now();
  let messagesDeleted = 0;
  let filesDeleted = 0;

  // Clean up messages
  for (const [id, msg] of messages.entries()) {
    if (now - msg.timestamp > MESSAGE_TTL) {
      messages.delete(id);
      messagesDeleted++;
    }
  }

  // Clean up files
  for (const [id, file] of files.entries()) {
    if (now - file.timestamp > MESSAGE_TTL) {
      files.delete(id);
      filesDeleted++;
    }
  }

  if (messagesDeleted > 0 || filesDeleted > 0) {
    console.log(`Cleanup: removed ${messagesDeleted} messages, ${filesDeleted} files`);
  }
}

// Run cleanup every 30 seconds
setInterval(cleanup, 30000);

// Get active messages (within TTL)
function getActiveMessages() {
  const now = Date.now();
  const activeMessages = [];
  
  for (const msg of messages.values()) {
    if (now - msg.timestamp <= MESSAGE_TTL) {
      activeMessages.push({
        ...msg,
        remainingTime: MESSAGE_TTL - (now - msg.timestamp)
      });
    }
  }
  
  // Sort by timestamp
  return activeMessages.sort((a, b) => a.timestamp - b.timestamp);
}

// Check rate limit for a socket
function checkRateLimit(socketId) {
  const now = Date.now();
  const lastTime = rateLimits.get(socketId);
  
  if (lastTime && now - lastTime < RATE_LIMIT_WINDOW) {
    return false;
  }
  
  rateLimits.set(socketId, now);
  return true;
}

// Create HTTP server for file uploads and health checks
const httpServer = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      messages: messages.size,
      uptime: process.uptime()
    }));
    return;
  }

  // File upload endpoint
  if (req.url === '/upload' && req.method === 'POST') {
    let body = Buffer.alloc(0);
    let contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > MAX_FILE_SIZE) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File too large. Max size is 1 MB.' }));
      return;
    }

    req.on('data', (chunk) => {
      body = Buffer.concat([body, chunk]);
      if (body.length > MAX_FILE_SIZE) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File too large. Max size is 1 MB.' }));
        req.destroy();
        return;
      }
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body.toString());
        
        if (!data.fileData || !data.fileName || !data.mimeType) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required fields' }));
          return;
        }

        // Check base64 size
        const base64Size = Buffer.byteLength(data.fileData, 'base64');
        if (base64Size > MAX_FILE_SIZE) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File too large. Max size is 1 MB.' }));
          return;
        }

        const fileId = generateFileId();
        files.set(fileId, {
          id: fileId,
          data: data.fileData,
          mimeType: data.mimeType,
          fileName: data.fileName,
          timestamp: Date.now()
        });

        const fileUrl = `/files/${fileId}`;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          fileUrl, 
          fileId,
          expiresIn: MESSAGE_TTL 
        }));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // File download endpoint
  if (req.url.startsWith('/files/') && req.method === 'GET') {
    const fileId = req.url.split('/')[2];
    const file = files.get(fileId);

    if (!file) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found or expired' }));
      return;
    }

    // Check if file is expired
    if (Date.now() - file.timestamp > MESSAGE_TTL) {
      files.delete(fileId);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found or expired' }));
      return;
    }

    const buffer = Buffer.from(file.data, 'base64');
    res.writeHead(200, { 
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Content-Length': buffer.length
    });
    res.end(buffer);
    return;
  }

  // Default response
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Broadcast message to all connected clients
function broadcast(data, excludeSocket = null) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client !== excludeSocket && client.readyState === 1) { // WebSocket.OPEN = 1
      client.send(message);
    }
  });
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const socketId = `${req.socket.remoteAddress}_${Date.now()}_${Math.random()}`;
  console.log(`Client connected: ${socketId}`);

  // Send current active messages to new client
  ws.send(JSON.stringify({
    type: 'init',
    messages: getActiveMessages()
  }));

  // Handle messages from client
  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());

      // Handle ping
      if (parsed.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Handle chat message
      if (parsed.type === 'message') {
        // Rate limit check
        if (!checkRateLimit(socketId)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Rate limit exceeded. Please wait 3 seconds between messages.'
          }));
          return;
        }

        const text = parsed.text?.trim();
        const fileUrl = parsed.fileUrl || null;
        const fileName = parsed.fileName || null;

        if (!text && !fileUrl) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Message cannot be empty'
          }));
          return;
        }

        const messageId = generateMessageId();
        const timestamp = Date.now();

        const message = {
          id: messageId,
          text: text || '',
          timestamp,
          fileUrl,
          fileName
        };

        messages.set(messageId, message);

        // Broadcast to all clients
        broadcast({
          type: 'new_message',
          message: {
            ...message,
            remainingTime: MESSAGE_TTL
          }
        });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log(`Client disconnected: ${socketId}`);
    rateLimits.delete(socketId);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`WebSocket error for ${socketId}:`, error);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`OneMinute server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
