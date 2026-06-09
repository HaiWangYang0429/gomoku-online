const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const htmlPath = path.join(__dirname, 'gomoku.html');
    fs.readFile(htmlPath, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentRole = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === 'create_room') {
        const roomId = msg.roomId;
        const role = msg.role;

        if (rooms.has(roomId)) {
          ws.send(JSON.stringify({ type: 'error', message: '房间已存在' }));
          return;
        }

        rooms.set(roomId, { host: ws, guest: null, hostRole: role });
        currentRoom = roomId;
        currentRole = role;

        ws.send(JSON.stringify({ type: 'room_created', roomId, role }));
        console.log(`房间 ${roomId} 已创建，房主选择 ${role === 1 ? '黑棋' : '白棋'}`);
      }
      else if (msg.type === 'join_room') {
        const roomId = msg.roomId;
        const room = rooms.get(roomId);

        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: '房间不存在' }));
          return;
        }

        if (room.guest) {
          ws.send(JSON.stringify({ type: 'error', message: '房间已满' }));
          return;
        }

        room.guest = ws;
        currentRoom = roomId;
        currentRole = room.hostRole === 1 ? 2 : 1;

        room.host.send(JSON.stringify({ type: 'guest_joined' }));
        ws.send(JSON.stringify({ type: 'room_joined', roomId, role: currentRole, hostRole: room.hostRole }));

        console.log(`玩家加入房间 ${roomId}，选择 ${currentRole === 1 ? '黑棋' : '白棋'}`);
      }
      else if (msg.type === 'move' || msg.type === 'undo_request' || msg.type === 'undo_done' ||
               msg.type === 'restart_request' || msg.type === 'restart_done' || msg.type === 'surrender') {
        if (!currentRoom || !rooms.has(currentRoom)) {
          console.log(`[转发失败] currentRoom=${currentRoom}, 消息类型=${msg.type}`);
          return;
        }

        const room = rooms.get(currentRoom);
        const isHost = room.host === ws;
        const opponent = isHost ? room.guest : room.host;
        const role = isHost ? 'host' : 'guest';

        console.log(`[转发] 房间=${currentRoom}, 发送方=${role}, 消息类型=${msg.type}, 对手存在=${!!opponent}, 对手状态=${opponent ? opponent.readyState : 'null'}`);

        if (opponent && opponent.readyState === WebSocket.OPEN) {
          opponent.send(data.toString());
          console.log(`[转发成功] 房间=${currentRoom}, ${role} -> ${isHost ? 'guest' : 'host'}`);
        } else {
          console.log(`[转发跳过] 房间=${currentRoom}, 对手不可用`);
        }
      }
    } catch (e) {
      console.error('消息处理错误:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      const opponent = room.host === ws ? room.guest : room.host;

      if (opponent && opponent.readyState === WebSocket.OPEN) {
        opponent.send(JSON.stringify({ type: 'opponent_disconnected' }));
      }

      rooms.delete(currentRoom);
      console.log(`房间 ${currentRoom} 已删除（玩家断开）`);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket 错误:', err.message);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║          五子棋联机服务器已启动                          ║
╠════════════════════════════════════════════════════════╣
║  本机访问:  http://localhost:${PORT}                      ║
║  局域网访问: http://<你的IP>:${PORT}                      ║
╠════════════════════════════════════════════════════════╣
║  使用方法:                                              ║
║  1. 在本机浏览器打开上述地址                             ║
║  2. 朋友在另一台电脑打开相同地址                         ║
║  3. 一人创建房间，另一人加入房间                         ║
╚════════════════════════════════════════════════════════╝
  `);
});
