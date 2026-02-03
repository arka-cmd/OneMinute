import { WebSocketServer } from 'ws';
import http from 'http';
import crypto from 'crypto';

const adjectives = ['Blue', 'Silent', 'Quick', 'Hidden', 'Cold', 'Dark'];
const animals = ['Fox', 'Wolf', 'Owl', 'Tiger', 'Raven', 'Shark'];

function generateAnonName() {
  return (
    adjectives[Math.floor(Math.random() * adjectives.length)] +
    animals[Math.floor(Math.random() * animals.length)] +
    '#' +
    Math.floor(100 + Math.random() * 900)
  );
}

const PORT = process.env.PORT || 3000;
const MESSAGE_TTL = 10 * 60 * 1000; // 10 minutes in milliseconds
const RATE_LIMIT_WINDOW = 3000; // 3 seconds for messages
const RATE_LIMIT_UPLOAD = 5000; // 5 seconds for uploads ✅ NEW
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

// In-memory storage
const files = new Map(); // fileId -> { data, mimeType, timestamp, fileName }
const rateLimits = new Map(); // socketId/IP -> lastMessageTime

let fileIdCounter = 0;

const rooms = new Map();

// Global room with messages array
rooms.set('global', {
  id: 'global',
  isPrivate: false,
  members: new Set(),
  messages: []
});

// Visit tracking storage
const visits = {
  daily: new Map(),
  monthly: new Map()
};

// ✅ NEW: System message helper
function systemMessage(roomId, text) {
  const msg = {
    id: `sys_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    text,
    timestamp: Date.now(),
    sender: 'System',
    senderId: 'system',
    isSystem: true
  };

  const room = rooms.get(roomId);
  if (!room) return;

  room.messages.push(msg);
  broadcastToRoom(roomId, { type: 'new_message', message: msg });
}

function joinRoom(ws, roomId) {
  leaveRoom(ws);
  ws.user.currentRoom = roomId;

  const room = rooms.get(roomId);
  if (!room) return;

  room.members.add(ws);

  // Broadcast user count and list
  broadcastUserCount(roomId);
  broadcastUserList(roomId);

  // Get username for this room
  const username = roomId === 'global' 
    ? ws.user.anonName 
    : ws.user.roomNames.get(roomId) || 'Guest';

  // ✅ NEW: Send system message for join
  systemMessage(roomId, `${username} joined the room`);

  ws.send(JSON.stringify({
    type: 'init',
    roomId,
    messages: getActiveMessages(roomId),
    username
  }));
}

function leaveRoom(ws) {
  const room = rooms.get(ws.user.currentRoom);
  if (!room) return;

  // ✅ NEW: Get username before leaving
  const username = ws.user.currentRoom === 'global'
    ? ws.user.anonName
    : ws.user.roomNames.get(ws.user.currentRoom) || 'Guest';

  room.members.delete(ws);
  
  // ✅ NEW: Send system message for leave
  if (room.members.size > 0) { // Only if someone is left to see it
    systemMessage(room.id, `${username} left the room`);
  }

  // Broadcast updated counts and list
  broadcastUserCount(room.id);
  broadcastUserList(room.id);
}

// Generate unique file ID
function generateFileId() {
  return `file_${Date.now()}_${++fileIdCounter}`;
}

// Get active messages from a room
function getActiveMessages(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];

  const now = Date.now();
  return room.messages
    .filter(msg => now - msg.timestamp <= MESSAGE_TTL)
    .map(msg => ({
      ...msg,
      remainingTime: MESSAGE_TTL - (now - msg.timestamp)
    }));
}

// Check rate limit for a socket or IP
function checkRateLimit(identifier, window = RATE_LIMIT_WINDOW) {
  const now = Date.now();
  const lastTime = rateLimits.get(identifier);
  
  if (lastTime && now - lastTime < window) {
    return false;
  }
  
  rateLimits.set(identifier, now);
  return true;
}

// Clean up expired messages and files
setInterval(() => {
  const now = Date.now();
  let messagesDeleted = 0;
  let filesDeleted = 0;

  // Clean up messages in all rooms
  rooms.forEach(room => {
    const beforeCount = room.messages.length;
    room.messages = room.messages.filter(
      msg => now - msg.timestamp <= MESSAGE_TTL
    );
    messagesDeleted += beforeCount - room.messages.length;
  });

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
}, 30000);

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

  // Stats endpoint
  if (req.url === '/stats' && req.method === 'GET') {
    let totalMessages = 0;
    rooms.forEach(room => {
      totalMessages += room.messages.length;
    });

    const dailyStats = {};
    visits.daily.forEach((count, date) => {
      dailyStats[date] = count;
    });

    const monthlyStats = {};
    visits.monthly.forEach((count, month) => {
      monthlyStats[month] = count;
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      visits: {
        daily: dailyStats,
        monthly: monthlyStats
      },
      current: {
        messages: totalMessages,
        rooms: rooms.size,
        connections: wss.clients.size
      },
      uptime: Math.floor(process.uptime())
    }));
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    let totalMessages = 0;
    rooms.forEach(room => {
      totalMessages += room.messages.length;
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      messages: totalMessages,
      rooms: rooms.size,
      uptime: process.uptime()
    }));
    return;
  }

  // File upload endpoint
  if (req.url === '/upload' && req.method === 'POST') {
    // ✅ NEW: Rate limit uploads by IP
    const clientIp = req.socket.remoteAddress;
    if (!checkRateLimit(clientIp, RATE_LIMIT_UPLOAD)) {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Too many uploads. Please wait a few seconds.' }));
      return;
    }

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

// Broadcast message to room
function broadcastToRoom(roomId, data) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(data);
  room.members.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

// Broadcast user count to all members in a room
function broadcastUserCount(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  broadcastToRoom(roomId, {
    type: 'room_users',
    roomId,
    count: room.members.size
  });
}

// Get list of users in a room
function getRoomUsers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];

  return Array.from(room.members).map(ws => ({
    id: ws.user.id,
    name: roomId === 'global'
      ? ws.user.anonName
      : ws.user.roomNames.get(roomId)
  }));
}

// Broadcast user list to all members in a room
function broadcastUserList(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  broadcastToRoom(roomId, {
    type: 'room_user_list',
    users: getRoomUsers(roomId)
  });
}

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  ws.user = {
    id: crypto.randomUUID(),
    anonName: generateAnonName(),
    currentRoom: 'global',
    roomNames: new Map()
  };

  const socketId = ws.user.id;

  // Track visit statistics
  const now = new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const monthKey = now.toISOString().slice(0, 7);

  visits.daily.set(dayKey, (visits.daily.get(dayKey) || 0) + 1);
  visits.monthly.set(monthKey, (visits.monthly.get(monthKey) || 0) + 1);

  // ✅ IMPROVED: Clean up ghost sockets from all rooms
  wss.clients.forEach(client => {
    if (client !== ws && client.readyState !== 1) {
      rooms.forEach(room => room.members.delete(client));
    }
  });

  console.log(`Client connected: ${socketId} (Daily: ${visits.daily.get(dayKey)}, Monthly: ${visits.monthly.get(monthKey)})`);

  // Send user identity on initial connection
  ws.send(JSON.stringify({
    type: 'identity',
    userId: ws.user.id,
    anonName: ws.user.anonName
  }));

  // Join global room (joinRoom will send init with messages)
  joinRoom(ws, 'global');

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
        if (!checkRateLimit(ws.user.id)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Slow down.'
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

        const timestamp = Date.now();

        const message = {
          id: `msg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
          text: text || '',
          timestamp,
          fileUrl,
          fileName,
          sender: ws.user.currentRoom === 'global'
            ? ws.user.anonName
            : ws.user.roomNames.get(ws.user.currentRoom) || 'Guest',
          senderId: ws.user.id
        };

        // Store message in room
        const room = rooms.get(ws.user.currentRoom);
        if (!room) return;

        room.messages.push(message);

        // Broadcast to room
        broadcastToRoom(ws.user.currentRoom, {
          type: 'new_message',
          message
        });
      }

      // Handle room creation
      if (parsed.type === 'create_room') {
        const roomId = crypto.randomUUID();
        const roomKey = crypto.randomBytes(6).toString('hex');
        
        rooms.set(roomId, {
          id: roomId,
          key: roomKey,
          isPrivate: true,
          members: new Set(),
          messages: []
        });

        const username = parsed.username?.trim() || 'Host';
        
        if (username.length === 0 || username.length > 20) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Username must be between 1 and 20 characters'
          }));
          return;
        }

        ws.user.roomNames.set(roomId, username);

        joinRoom(ws, roomId);

        ws.send(JSON.stringify({
          type: 'room_created',
          roomId,
          roomKey,
          username
        }));
      }

      // Handle room join
      if (parsed.type === 'join_room') {
        const roomId = parsed.roomId;
        const room = rooms.get(roomId);
        
        if (!room || (room.isPrivate && room.key !== parsed.roomKey)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid room or key'
          }));
          return;
        }

        const username = parsed.username?.trim() || 'Guest';
        
        if (username.length === 0 || username.length > 20) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Username must be between 1 and 20 characters'
          }));
          return;
        }

        // Check for duplicate username
        const isDuplicate = Array.from(room.members).some(
          client => client.user.roomNames.get(roomId) === username
        );
        
        if (isDuplicate) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Username "${username}" is already taken in this room`
          }));
          return;
        }

        ws.user.roomNames.set(roomId, username);
        
        joinRoom(ws, roomId);
      }

      // Handle leave room (return to global)
      if (parsed.type === 'leave_room') {
        joinRoom(ws, 'global');
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
    
    const currentRoom = rooms.get(ws.user.currentRoom);
    
    // ✅ IMPROVED: Clean up from ALL rooms and broadcast updates
    rooms.forEach(room => {
      if (room.members.has(ws)) {
        room.members.delete(ws);
        broadcastUserCount(room.id);
        broadcastUserList(room.id);
      }
    });
    
    rateLimits.delete(socketId);

    // Auto-destroy empty private rooms
    if (currentRoom && currentRoom.isPrivate && currentRoom.members.size === 0) {
      rooms.delete(currentRoom.id);
      console.log(`Deleted empty private room: ${currentRoom.id}`);
    }
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
  console.log(`Stats endpoint: http://localhost:${PORT}/stats`);
});