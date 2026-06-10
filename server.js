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
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const wss = new WebSocket.Server({ server });

const rooms = new Map();

const CHARACTERS = [
  { id: 0, name: '黄龙士', title: '清代棋圣', emoji: '🏯', lines: ['让三子如何？','天下无敌手','老夫先行一步','这局稳了','且慢，妙手！','尔等何人？','棋逢对手难','承让承让','这手如何？','不过如此','吾已有数','落子无悔','纵横天下间','谁敢一战？','观棋不语'] },
  { id: 1, name: '范西屏', title: '清代国手', emoji: '🎋', lines: ['且看我这手','当湖十局来！','妙极妙极','你且接招','此局精彩','棋道无穷','快哉快哉','好棋好棋','这一手绝了','让某来破之','天下棋手谁敌','闲庭信步','某已算到','不慌不忙','棋如人生'] },
  { id: 2, name: '施襄夏', title: '清代国手', emoji: '🌊', lines: ['妙在不言中','静水流深','以柔克刚','后发制人','意在棋先','落子有声','心如止水','不急不急','当湖论棋','此着甚好','容我三思','棋中有天地','无为而治','从容以对','胜固欣然'] },
  { id: 3, name: '本因坊秀策', title: '日本棋圣', emoji: '⛩️', lines: ['耳赤一手！','御城棋不败','秀策流开局','尖！','此手极厚','步步为营','定式如此','先手利','厚势制胜','棋之正道','不可轻敌','一手定乾坤','全局在胸','稳如磐石','本因坊之名'] },
  { id: 4, name: '吴清源', title: '昭和棋圣', emoji: '☯️', lines: ['中的精神','六合之棋','新布局来了','星位开局','调和为上','棋道即天道','无招胜有招','二十一世纪','天才的一手','以和为贵','超越胜负','中和之美','宇宙流','自然之道','棋如流水'] },
  { id: 5, name: '聂卫平', title: '棋圣', emoji: '🇨🇳', lines: ['大局为重','这棋好下','我赢了','没问题！','中日擂台赛','来，喝酒！','小菜一碟','稳赢的棋','大局观第一','算清楚了','这盘拿下','国争光！','该我了','小意思','赢定了'] },
  { id: 6, name: '柯洁', title: '八冠王', emoji: '🔥', lines: ['我不会输！','血性！','这棋太爽了','AlphaGo来！','我比谁都强','年轻人就该冲','赢了赢了','不服来战','世界最强','全力进攻','没什么好怕的','就是干！','冠军属于我','这手厉害吧','我太难了'] },
  { id: 7, name: '李世石', title: '十四冠王', emoji: '💎', lines: ['胜负未分','神之一手！','我不会放弃','这局我赢了','逆转开始','李世石流','僵尸流启动','绝境反击','弃子战术','不可思议','这就是围棋','我命由我','翻盘时刻','最后一搏','精彩绝伦'] },
  { id: 8, name: '李昌镐', title: '石佛', emoji: '🗿', lines: ['嗯…','…','官子阶段','半目胜','够了','差不多','就这样吧','还行','无所谓','按部就班','不着急','慢慢来','收官了','计算中','冷静'] },
  { id: 9, name: '古力', title: '八冠王', emoji: '⚔️', lines: ['杀！','力战到底！','屠龙！','来对杀！','不怕你','硬刚正面','大龙别跑','吃你一块','进攻！进攻！','暴力美学','一力降十会','谁怕谁','决战到底','痛快！','好战分子'] },
  { id: 10, name: '赵治勋', title: '斗魂', emoji: '🔥', lines: ['斗魂燃烧！','永不放弃','读秒之王','逆境求生','我就是不服','绝地反击','拼到最后一刻','绝不认输','逆转！','读秒也不怕','死也要赢','棋如战场','斗志昂扬','浴火重生','永不言败'] },
  { id: 11, name: '坂田荣男', title: '剃刀', emoji: '🗡️', lines: ['利刃出鞘','一击必杀','精确计算','剃刀坂田','锐不可当','手筋来了','犀利无比','切割战场','见缝插针','快刀斩乱麻','刀刀致命','精准打击','毫不留情','锋利至极','削铁如泥'] },
  { id: 12, name: '胡荣华', title: '象棋泰斗', emoji: '🐉', lines: ['棋道无止境','十四冠而已','胡氏象棋','姜还是老的辣','后生可畏','棋无止境','来，下一盘','飞刀来了','反宫马开局','经验之谈','老当益壮','以棋会友','妙手偶得','大师风范','棋如战场'] },
  { id: 13, name: '杨官璘', title: '魔叔', emoji: '👴', lines: ['残局见功夫','功夫在棋外','残棋圣手','慢慢磨','铁磨铁','不急不急','以逸待劳','残局定胜负','滴水穿石','稳扎稳打','魔叔出手','精雕细琢','水到渠成','棋如品茶','老姜够辣'] },
  { id: 14, name: '许银川', title: '少年姜太公', emoji: '🎣', lines: ['先为不可胜','稳如泰山','姜太公钓鱼','不战而屈人','以静制动','无懈可击','少年老成','不动如山','防守反击','固若金汤','耐心等待','机会来了','沉着冷静','从容应对','稳中求胜'] },
  { id: 15, name: '王天一', title: '外星人', emoji: '👽', lines: ['算无遗策','等级分第一','精确打击','AI都怕我','算路深远','外星人思维','碾压！','这棋太简单','完美对局','一览无余','全盘掌控','降维打击','无敌手','轻松拿下','又赢了'] },
  { id: 16, name: '赵国荣', title: '东北虎', emoji: '🐯', lines: ['虎啸棋枰！','猛虎下山','东北虎来了','霸气侧漏','虎步龙行','威震四方','一虎当关','猛虎扑食','虎虎生风','东北爷们！','豪气冲天','大力出奇迹','干就完了','硬碰硬','虎踞龙盘'] },
  { id: 17, name: '卡斯帕罗夫', title: '棋王', emoji: '👑', lines: ['进攻！','我是棋王！','深蓝色来了','碾压一切','动态进攻','永不退缩','王者归来','最强人类','攻势如潮','我的时代','无敌棋王','全力以赴','势不可挡','天才出击','王冠在此'] },
  { id: 18, name: '费舍尔', title: '美国棋王', emoji: '🦅', lines: ['我谁都不怕','苏联人作弊','我要世界冠军','完美对局','我就是最强','冷战之王','费舍尔开局','六连胜！','没人能赢我','我是传奇','天才的骄傲','不服？来！','独战群雄','绝对碾压','我要求加钱'] },
  { id: 19, name: '卡尔森', title: '挪威神童', emoji: '🧊', lines: ['直觉告诉我','残局之王','又赢了','毫无压力','冷静如水','挪威来的','世界冠军','轻松愉快','直觉就是答案','无所谓输赢','享受棋局','残局见功力','碾压式胜利','冰与火','冷静思考'] },
  { id: 20, name: '卡帕布兰卡', title: '天才', emoji: '🎩', lines: ['一看就懂','太简单了','不需要思考','人肉象棋机','直觉就好','天才的一手','棋如艺术','优雅落子','不费吹灰力','天赋异禀','古巴之光','完美主义','轻松获胜','浑然天成','举重若轻'] },
  { id: 21, name: '羽生善治', title: '永世七冠', emoji: '🌸', lines: ['直觉即答案','七冠达成','将棋之神','一手妙棋','终盘魔术师','羽生魔术','不可思议','居飞车穴熊','直觉落子','棋如花开','善治一击','终盘见真章','永世名人','天才直觉','花开一瞬'] },
  { id: 22, name: '大山康晴', title: '永世名人', emoji: '🛡️', lines: ['防守即进攻','大山壁','坚不可摧','耐心等待','以守为攻','铁壁防守','反击时刻','不动如山','防守大师','稳如磐石','后发先至','以柔克刚','大巧若拙','名人之风','铜墙铁壁'] },
  { id: 23, name: '中村茂', title: '五子棋名人', emoji: '⭐', lines: ['先手必胜！','五子连珠','名人卫冕','必胜开局','完美定式','连五成线','先手优势','棋道精进','五子棋之神','名人之战','步步紧逼','攻守兼备','五子纵横','珠联璧合','一子定乾坤'] },
];

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

        const hostCharId = Math.floor(Math.random() * CHARACTERS.length);

        rooms.set(roomId, { host: ws, guest: null, hostRole: role, hostCharId });
        currentRoom = roomId;
        currentRole = role;

        ws.send(JSON.stringify({ type: 'room_created', roomId, role, character: CHARACTERS[hostCharId] }));
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

        let guestCharId;
        do {
          guestCharId = Math.floor(Math.random() * CHARACTERS.length);
        } while (guestCharId === room.hostCharId);

        room.guest = ws;
        room.guestCharId = guestCharId;
        currentRoom = roomId;
        currentRole = room.hostRole === 1 ? 2 : 1;

        room.host.send(JSON.stringify({ type: 'guest_joined', opponentCharacter: CHARACTERS[guestCharId] }));
        ws.send(JSON.stringify({ type: 'room_joined', roomId, role: currentRole, hostRole: room.hostRole, character: CHARACTERS[guestCharId], opponentCharacter: CHARACTERS[room.hostCharId] }));

        console.log(`玩家加入房间 ${roomId}，选择 ${currentRole === 1 ? '黑棋' : '白棋'}`);
      }
      else if (msg.type === 'move' || msg.type === 'undo_request' || msg.type === 'undo_done' ||
               msg.type === 'restart_request' || msg.type === 'restart_done' || msg.type === 'restart_rejected' ||
               msg.type === 'surrender' || msg.type === 'projectile' || msg.type === 'rematch') {
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
