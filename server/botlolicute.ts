// ==================== Cấu hình và Imports ====================
import * as mineflayer from 'mineflayer';
import { pathfinder, Movements } from 'mineflayer-pathfinder';
// @ts-ignore
import * as goals from 'mineflayer-pathfinder/lib/goals';
import { answerQuestion, helpWithTask, generateLoliResponse } from './gemini';

// Type declarations for global
declare global {
  var BOTLOLICUTE_PROCESS_LOCK: number | undefined;
}

// Cấu hình bot với settings ổn định hơn
const BOT_CONFIG = {
  host: 'thuatzai123.aternos.me',
  port: 38893,
  username: 'botlolicute',
  version: '1.19.4',
  skipValidation: true,
  checkTimeoutInterval: 60000,
  keepAlive: true,
  hideErrors: false,
  auth: 'offline' as 'offline'
};

// ==================== Biến trạng thái và Lock Process ====================
const PROCESS_LOCK_KEY = 'BOTLOLICUTE_PROCESS_LOCK';
const processStartTime = Date.now();

// Kiểm tra nếu đã có process khác đang chạy
if (global[PROCESS_LOCK_KEY]) {
  console.log('⚠️ Bot process khác đã đang chạy, thoát để tránh duplicate login...');
  process.exit(0);
}

// Chỉ chạy bot nếu không phải trong web server process
if (process.env.BOT_DISABLED === 'true') {
  console.log('🚫 Bot bị tắt do chạy trong web server process');
  process.exit(0);
}

// Thêm delay ngẫu nhiên để tránh race condition và check duplicate
const startDelay = Math.random() * 3000;
setTimeout(() => {
  if (global[PROCESS_LOCK_KEY] && global[PROCESS_LOCK_KEY] !== processStartTime) {
    console.log('⚠️ Process khác đã khởi động bot, thoát...');
    process.exit(0);
  }
  
  console.log('🚀 Đang khởi động Bot Lolicute...');
  startBot();
}, startDelay);

// Lock process này
global[PROCESS_LOCK_KEY] = processStartTime;

// Cleanup khi process kết thúc
process.on('SIGINT', () => {
  console.log('🛑 Nhận signal SIGINT, đang cleanup...');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Nhận signal SIGTERM, đang cleanup...');
  cleanup();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});

// Biến trạng thái
let bot: any = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 7;
let movementInterval: NodeJS.Timeout | null = null;

let lastHealthChatTime = 0;
const HEALTH_CHAT_DELAY = 20000;
let currentMode = 'idle';
let targetPlayer: any = null;
let followingInterval: NodeJS.Timeout | null = null;
let protectingInterval: NodeJS.Timeout | null = null;
let currentCommand = '';
let autoFarmTarget = '';
let autoFarmInterval: NodeJS.Timeout | null = null;
let creeperAvoidanceMode = false;
let equipmentCheckInterval: NodeJS.Timeout | null = null;

// NEW EXPLORATION FEATURES
let exploringInterval: NodeJS.Timeout | null = null;
let selfDefenseInterval: NodeJS.Timeout | null = null;
let exploredChests: Set<string> = new Set();
let isInventoryFull = false;
let lastActivityTime = Date.now();

// MINING FEATURES
let miningInterval: NodeJS.Timeout | null = null;
let miningTarget = '';
let isWaitingForResponse = false;
let pendingUser = '';
let pendingAction = '';

// Chat delay cho combat messages
let lastCombatChatTime = 0;

// SELF DEFENSE FEATURES  
const IDLE_TIMEOUT = 3 * 60 * 1000;

// Bot screen data sharing
let botScreenData = {
  mode: 'idle',
  position: { x: 0, y: 0, z: 0 },
  health: 20,
  food: 20,
  targetPlayer: null,
  nearbyMobs: [],
  equipment: {
    weapon: null,
    armor: []
  },
  status: 'Đang chờ lệnh...',
  lastUpdate: Date.now()
};

// Chat queue and delay variables
const chatQueue: string[] = [];
let isChatting = false;
const CHAT_DELAY = 4000;
let lastChatTime = 0;

// Enhanced bot state management
let previousActivity = 'idle';
let droppedItemsLocation: any = null;
let isLowHealth = false;
let isHungry = false;

// Cấu hình pathfinder
let defaultMovements: Movements;


// ==================== Khởi động và Cleanup ====================
function cleanup() {
  if (global[PROCESS_LOCK_KEY] === processStartTime) {
    delete global[PROCESS_LOCK_KEY];
  }
  clearAllIntervalsAndPathfinder();
  if (bot) {
    try {
      bot.quit('Cleanup process');
    } catch (error) {
      console.log('⚠️ Error during bot cleanup, continuing...');
    }
  }
}

// Hàm khởi động bot chính
function startBot() {
  createBot();
}

// Hàm tạo bot an toàn với duplicate check
function createBot() {
  if (global[PROCESS_LOCK_KEY] && global[PROCESS_LOCK_KEY] !== processStartTime) {
    console.log('⚠️ Process lock conflict detected, exiting...');
    process.exit(0);
  }
  
  try {
    bot = mineflayer.createBot(BOT_CONFIG);
    setupBotEvents();
  } catch (error) {
    console.error('❌ Lỗi tạo bot:', error);
    attemptReconnect();
  }
}

// ==================== Quản lý Intervals và State ====================

// FIX: Hàm dừng tất cả hoạt động hiện tại một cách ngay lập tức
function stopCurrentActivity() {
  console.log(`🛑 Dừng hoạt động hiện tại: ${currentMode} -> idle`);
  
  const oldMode = currentMode;
  currentMode = 'idle';
  targetPlayer = null;
  currentCommand = '';
  autoFarmTarget = '';
  creeperAvoidanceMode = false;
  previousActivity = 'idle';

  // FIX: Dừng tất cả interval và pathfinder goal ngay lập tức
  clearAllIntervalsAndPathfinder();

  // Dừng tất cả movement controls ngay lập tức
  try {
    if (bot && isConnected) {
      ['forward', 'back', 'left', 'right', 'jump', 'sprint'].forEach(control => {
        bot.setControlState(control, false);
      });
    }
  } catch (error) {
    console.log('🔧 Lỗi dừng movement controls...');
  }

  updateBotScreen();
  
  console.log(`✅ Đã dừng hoạt động ${oldMode} thành công`);
}

// FIX: Hàm chung để clear tất cả intervals và pathfinder
function clearAllIntervalsAndPathfinder() {
  // Dừng pathfinder ngay lập tức
  if (bot && bot.pathfinder) {
    bot.pathfinder.setGoal(null);
  }

  // Dừng tất cả các intervals
  const intervals = [
    movementInterval, followingInterval, protectingInterval, 
    autoFarmInterval, equipmentCheckInterval, exploringInterval, 
    selfDefenseInterval, miningInterval
  ];
  intervals.forEach(interval => {
    if (interval) {
      clearInterval(interval);
    }
  });

  movementInterval = null;
  followingInterval = null;
  protectingInterval = null;
  autoFarmInterval = null;
  equipmentCheckInterval = null;
  exploringInterval = null;
  selfDefenseInterval = null;
  miningInterval = null;
}


// ==================== Thiết lập Events của Bot ====================
function setupBotEvents() {
  if (!bot) return;

  bot.on('spawn', () => {
    isConnected = true;
    reconnectAttempts = 0;
    console.log('💕 Bot Lolicute đã tham gia server! Konnichiwa minna-san! UwU');

    // Load pathfinder plugin và set up movements
    bot.loadPlugin(pathfinder);
    defaultMovements = new Movements(bot);
    bot.pathfinder.setMovements(defaultMovements);

    setTimeout(() => {
      safeChat('Chào mừng đến với bot loli! 💕 Tôi là bot dễ thương của bạn! (◕‿◕)♡');
    }, 2000);

    updateBotScreen();
    botScreenData.status = 'Đã kết nối thành công!';
    
    lastActivityTime = Date.now();
    
    // Start background systems
    startRandomMovement();
    startIdleMonitoring();
  });

  bot.on('chat', (username: string, message: string) => {
    handleChatMessage(username, message);
  });

  bot.on('message', (jsonMsg: any) => {
    handleRawMessage(jsonMsg);
  });

  bot.on('playerJoined', (player: any) => {
    console.log(`👋 ${player.username} đã tham gia server`);
    setTimeout(() => {
      safeChat(`Chào mừng ${player.username}-chan! (◕‿◕)♡ Hy vọng bạn sẽ vui vẻ ở đây! UwU`);
    }, 3000);
  });

  bot.on('playerLeft', (player: any) => {
    console.log(`👋 ${player.username} đã rời server`);
    safeChat(`Sayonara ${player.username}-chan! (´;ω;) Hẹn gặp lại! 💔`);

    if (targetPlayer && targetPlayer.username === player.username) {
      stopCurrentActivity();
      safeChat('Người mà tôi đang theo dõi đã rời đi! (´;ω;) Tôi sẽ nghỉ ngơi...');
    }
  });

  bot.on('health', () => {
    try {
      const now = Date.now();
      
      if (bot.health <= 6 && !isLowHealth) {
        isLowHealth = true;
        if (currentMode !== 'idle') {
          previousActivity = currentMode;
          stopCurrentActivity();
        }
        safeChat('Kyaa~! Máu thấp quá! Tôi phải chạy đi chữa trị! (>_<)');
        startHealthRecovery();
      } else if (bot.health > 10 && isLowHealth) {
        isLowHealth = false;
        safeChat('Phew! Máu đã an toàn rồi! Tôi sẽ tiếp tục hoạt động! ٩(◕‿◕)۶');
        resumePreviousActivity();
      }
      
      if (bot.health < 10 && now - lastHealthChatTime > HEALTH_CHAT_DELAY) {
        safeChat('Kyaa~! Tôi bị thương rồi! (>_<) Cần hồi máu gấp!');
        lastHealthChatTime = now;
      }
      if (bot.health === 20 && now - lastHealthChatTime > HEALTH_CHAT_DELAY) {
        safeChat('Yay! Máu đầy rồi! ٩(◕‿◕)۶ Cảm ơn mọi người!');
        lastHealthChatTime = now;
      }
    } catch (error) {
      console.log('🔧 Lỗi xử lý health event, bỏ qua...');
    }
  });

  bot.on('food', () => {
    try {
      if (bot.food <= 6 && !isHungry) {
        isHungry = true;
        safeChat('Ăn... đói quá! (´;ω;) Ai có đồ ăn không ạ?');
        attemptSelfFeeding();
      } else if (bot.food >= 18 && isHungry) {
        isHungry = false;
        safeChat('Cảm ơn! Đã no rồi! (◕‿◕)♡');
      }
    } catch (error) {
      console.log('🔧 Lỗi xử lý food event...');
    }
  });

  bot.on('death', () => {
    try {
      droppedItemsLocation = { ...bot.entity.position };
      safeChat('Nooo! Tôi đã chết! (;´∀`) Sẽ quay lại lụm đồ trong 5 giây!');
      
      setTimeout(() => {
        if (droppedItemsLocation && bot && isConnected) {
          safeChat('Tôi sẽ quay lại lụm đồ rớt! Wait for me!');
          returnToDroppedItems();
        }
      }, 5000);
    } catch (error) {
      console.log('🔧 Lỗi xử lý death event...');
    }
  });

  bot.on('entityHurt', (entity: any) => {
    if (currentMode === 'protecting' && targetPlayer) {
      checkForThreats();
    }
  });

  bot.on('end', (reason: any) => {
    handleDisconnection(reason);
  });

  bot.on('error', (err: any) => {
    handleBotError(err);
  });

  bot.on('kicked', (reason: any) => {
    isConnected = false;
    const reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
    console.log(`⚠️ Bot bị kick: ${reasonStr}`);

    if (reasonStr.includes('duplicate_login')) {
      console.log('🚫 DUPLICATE LOGIN DETECTED - Thoát ngay để tránh conflict...');
      if (global[PROCESS_LOCK_KEY] === processStartTime) {
        delete global[PROCESS_LOCK_KEY];
      }
      process.exit(0);
    }

    if (reasonStr && (reasonStr.toLowerCase().includes('throttled') || reasonStr.toLowerCase().includes('connection reset'))) {
      console.log('🕐 Chờ 60 giây do connection throttling hoặc reset...');
      setTimeout(() => {
        attemptReconnect();
      }, 60000);
    } else {
      setTimeout(() => {
        attemptReconnect();
      }, 15000);
    }
  });

  bot.on('login', () => {
    console.log('🔐 Đang đăng nhập vào server...');
  });
}

// ==================== Logic chính của Bot ====================

// FIX: Bắt đầu theo dõi player với pathfinding nâng cao
function startFollowing(player: any) {
  if (followingInterval) {
    clearInterval(followingInterval);
  }

  if (!bot.pathfinder || !player?.entity) {
    safeChat('Gomen! Pathfinder chưa sẵn sàng để theo dõi bạn! (´;ω;)');
    return;
  }

  console.log(`🏃 Bắt đầu theo dõi ${player.username}`);
  safeChat(`Hai ${player.username}-chan! Tôi sẽ theo bạn đi khắp nơi! ε=ε=ε=┌(˘▾˘)┘`);

  // Sử dụng GoalFollow của pathfinder để theo dõi mượt mà hơn
  // Khoảng cách 1.5 block để bot không quá sát và không bị kẹt
  const followDistance = 1.5;
  const goal = new goals.GoalFollow(player.entity, followDistance);
  bot.pathfinder.setGoal(goal);

  // Interval để update màn hình bot và kiểm tra player
  followingInterval = setInterval(() => {
    if (!isConnected || !bot || !player || !player.entity || currentMode !== 'following') {
      clearInterval(followingInterval!);
      stopCurrentActivity();
      return;
    }

    const distance = bot.entity.position.distanceTo(player.entity.position);
    botScreenData.targetPlayer = player.username;
    botScreenData.status = `Đang theo dõi ${player.username} (${distance.toFixed(1)}m)`;

    // Nếu cách quá xa, dùng tp
    if (distance > 25) {
      bot.chat(`/tp ${player.username}`);
      safeChat('Kyaa~! Bạn đi quá xa rồi! Tôi sẽ teleport đến! ✨');
      botScreenData.status = `Teleport đến ${player.username}`;
    }

    updateBotScreen();
  }, 500); // Check mỗi 0.5s
}

// Bắt đầu bảo vệ player - cải thiện
function startProtecting(player: any) {
  if (protectingInterval) {
    clearInterval(protectingInterval);
  }

  if (!bot.pathfinder || !player?.entity) {
    safeChat('Gomen! Pathfinder chưa sẵn sàng để bảo vệ bạn! (´;ω;)');
    return;
  }

  console.log(`🛡️ Bắt đầu bảo vệ ${player.username}`);
  safeChat(`Hai ${player.username}-chan! Tôi sẽ bảo vệ bạn khỏi tất cả quái vật! (ง •̀_•́)ง`);

  // Trang bị đồ xịn nhất
  startAutoEquipment();
  
  // Sử dụng GoalFollow để giữ khoảng cách bảo vệ
  const protectDistance = 2.5;
  const goal = new goals.GoalFollow(player.entity, protectDistance);
  bot.pathfinder.setGoal(goal);

  protectingInterval = setInterval(() => {
    if (!isConnected || !bot || !player || !player.entity || currentMode !== 'protecting') {
      clearInterval(protectingInterval!);
      stopCurrentActivity();
      return;
    }

    try {
      const threats = checkForThreats();
      
      if (threats.length > 0) {
        botScreenData.status = `Đang chiến đấu với ${threats.length} quái vật!`;
      } else {
        botScreenData.status = `Đang tuần tra bảo vệ ${player.username}`;
        // Nếu không có threat, tiếp tục theo player
        if (!bot.pathfinder.goal) {
          bot.pathfinder.setGoal(goal);
        }
      }

      updateBotScreen();

    } catch (error) {
      console.log('🔧 Lỗi trong chế độ bảo vệ...');
      botScreenData.status = 'Lỗi trong chế độ bảo vệ';
      updateBotScreen();
    }
  }, 500);
}

function checkForThreats() {
  if (!bot || !targetPlayer || !targetPlayer.entity) return [];

  try {
    const playerPos = targetPlayer.entity.position;
    const nearbyEntities = Object.values(bot.entities).filter((entity: any) => {
      if (!entity || !entity.position) return false;

      const distance = entity.position.distanceTo(playerPos);
      const isMob = entity.type === 'mob' && entity.displayName !== 'Armor Stand';
      const isHostile = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch'].includes(entity.name?.toLowerCase() || entity.displayName?.toLowerCase() || '');

      return distance <= 10 && (isMob || isHostile) && entity.id !== bot.entity.id;
    });

    botScreenData.nearbyMobs = nearbyEntities.map((entity: any) => ({
      name: entity.name || entity.displayName || 'Unknown',
      distance: entity.position.distanceTo(bot.entity.position).toFixed(1)
    })) as any[];

    if (nearbyEntities.length > 0) {
      const threat = nearbyEntities[0] as any;
      const threatDistance = (threat as any).position.distanceTo(bot.entity.position);

      if (threatDistance > 10) {
        bot.chat(`/tp ${targetPlayer.username}`);
        safeChat('Có quái vật! Tôi đang đến bảo vệ bạn! (ง •̀_•́)ง');
        botScreenData.status = `Teleport đến ${targetPlayer.username} để bảo vệ`;
      } else {
        if ((threat as any).name && (threat as any).name.toLowerCase().includes('creeper')) {
          attackCreeper(threat);
        } else {
          attackEntity(threat);
        }
      }
    }

    return nearbyEntities;
  } catch (error) {
    console.log('🔧 Lỗi check threats...');
    return [];
  }
}

function attackEntity(entity: any) {
  try {
    if (!bot || !entity) return;

    bot.attack(entity);
    const entityName = entity.name || entity.mobType || 'Unknown';
    
    const now = Date.now();
    if (now - lastCombatChatTime > 5000) {
      safeChat(`Take this! Tôi sẽ bảo vệ chủ nhân! (ง •̀_•́)ง ${entityName}!`);
      lastCombatChatTime = now;
    }

    setTimeout(() => {
      if ((currentMode === 'protecting' || currentMode === 'autofarming') && targetPlayer) {
        if (bot.pathfinder) {
          bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer.entity, 2.5));
        }
      }
    }, 2000);

  } catch (error) {
    console.log('🔧 Lỗi tấn công entity...');
  }
}

function attackCreeper(creeper: any) {
  try {
    if (!bot || !creeper) return;

    creeperAvoidanceMode = true;
    safeChat('Creeper detected! Tôi sẽ hit & run! (ง •̀_•́)ง 💥');

    const hitAndRunInterval = setInterval(() => {
      if (!creeper || !bot || !isConnected) {
        clearInterval(hitAndRunInterval);
        creeperAvoidanceMode = false;
        return;
      }

      const distance = bot.entity.position.distanceTo(creeper.position);

      if (distance > 15) {
        clearInterval(hitAndRunInterval);
        creeperAvoidanceMode = false;
        safeChat('Creeper đã được tiêu diệt hoặc thoát khỏi tầm! ✨');
        return;
      }

      if (distance > 4) {
        bot.pathfinder.setGoal(new goals.GoalNear(creeper.position.x, creeper.position.y, creeper.position.z, 2));
      } else if (distance <= 4 && distance > 2) {
        bot.attack(creeper);
      } else {
        bot.pathfinder.setGoal(new goals.GoalNear(creeper.position.x, creeper.position.y, creeper.position.z, 6));
      }
    }, 500);
  } catch (error) {
    console.log('🔧 Lỗi tấn công creeper...');
    creeperAvoidanceMode = false;
  }
}

function startAutoFarm(mobType: string) {
  if (autoFarmInterval) {
    clearInterval(autoFarmInterval);
  }

  startAutoEquipment();
  safeChat(`Bắt đầu auto farm ${mobType}! Tôi sẽ dùng đồ tốt nhất! (ง •̀_•́)ง ✨`);

  autoFarmInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'autofarming') {
      clearInterval(autoFarmInterval!);
      return;
    }

    try {
      const targetMobs = Object.values(bot.entities).filter((entity: any) => {
        if (!entity || !entity.position) return false;

        const distance = entity.position.distanceTo(bot.entity.position);
        const matchesMobType = entity.name && entity.name.toLowerCase().includes(mobType.toLowerCase());

        return distance <= 20 && matchesMobType && entity.id !== bot.entity.id;
      });

      if (targetMobs.length > 0) {
        const closestMob = targetMobs.reduce((closest: any, current: any) => {
          const closestDist = bot.entity.position.distanceTo(closest.position);
          const currentDist = bot.entity.position.distanceTo(current.position);
          return currentDist < closestDist ? current : closest;
        }, null);

        farmMob(closestMob);
      } else {
        exploreRandomDirection();
      }
    } catch (error) {
      console.log('🔧 Lỗi auto farm...');
    }
  }, 2000);
}

function farmMob(mob: any) {
  try {
    const distance = bot.entity.position.distanceTo(mob.position);

    if (distance > 3) {
      bot.pathfinder.setGoal(new goals.GoalFollow(mob, 2));
    } else {
      bot.pathfinder.setGoal(null);
      if (mob.name && mob.name.toLowerCase().includes('creeper')) {
        attackCreeper(mob);
      } else {
        attackEntity(mob);
      }
    }

  } catch (error) {
    console.log('🔧 Lỗi farm mob...');
  }
}

// ==================== Các hàm hỗ trợ khác ====================
function safeChat(message: string) {
  try {
    if (!bot || !isConnected || !message || message.length === 0) return;
    
    const now = Date.now();
    if (now - lastChatTime < CHAT_DELAY) {
      chatQueue.push(message);
      return;
    }
    
    lastChatTime = now;
    bot.chat(message);
    console.log(`🤖 Bot: ${message}`);
    
    setTimeout(() => {
      if (chatQueue.length > 0 && bot && isConnected) {
        const nextMessage = chatQueue.shift();
        if (nextMessage) {
          safeChat(nextMessage);
        }
      }
    }, CHAT_DELAY);
  } catch (error) {
    console.log('🔧 Lỗi gửi chat message...');
  }
}

function handleChatMessage(username: any, message: any) {
  try {
    if (!username || username === bot?.username) return;
    const messageStr = safeStringify(message);
    const usernameStr = safeStringify(username);
    console.log(`📩 ${usernameStr}: ${messageStr}`);
    processUserMessage(usernameStr, messageStr);
  } catch (error) {
    console.log('🔧 Lỗi xử lý chat message, bỏ qua...');
  }
}

function handleRawMessage(jsonMsg: any) {
  try {
    if (!jsonMsg) return;
    if (typeof jsonMsg === 'object' && jsonMsg.toString) {
      const msgStr = jsonMsg.toString();
      if (msgStr.includes('[object Object]') || msgStr.includes('chat format code')) {
        return;
      }
    }
    let messageText = '';
    if (typeof jsonMsg === 'string') {
      messageText = jsonMsg;
    } else if (typeof jsonMsg === 'object') {
      if (jsonMsg.text && typeof jsonMsg.text === 'string') {
        messageText = jsonMsg.text;
      } else if (jsonMsg.translate && typeof jsonMsg.translate === 'string') {
        messageText = jsonMsg.translate;
      } else {
        return;
      }
    }
    if (messageText && messageText.trim() && 
        !messageText.includes('BotLolicute') && 
        messageText.length > 3) {
      console.log(`📨 Server: ${messageText.substring(0, 100)}`);
    }
  } catch (error) {
  }
}

function processUserMessage(username: string, message: string) {
  try {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hỏi nè')) {
      const questionMatch = message.match(/hỏi nè\s+(.+)/i);
      if (questionMatch) {
        const question = questionMatch[1];
        safeChat(`Để tớ nghĩ một chút nhé ${username}-chan... 🤔💭`);
        answerQuestion(question, username).then(answer => {
          safeChat(answer);
        }).catch(error => {
          console.log('🔧 Lỗi Gemini question:', error);
          safeChat(`Gomen ${username}-chan! Tôi không thể suy nghĩ được... (´;ω;)`);
        });
      } else {
        safeChat(`${username}-chan muốn hỏi gì không? Hãy nói "hỏi nè [câu hỏi]" nha! (◕‿◕)`);
      }
      return;
    }

    if (lowerMessage.includes('nghe tớ nè')) {
      const taskMatch = message.match(/nghe tớ nè\s+(.+)/i);
      if (taskMatch) {
        const task = taskMatch[1];
        safeChat(`Hai ${username}-chan! Để tớ nghĩ cách giúp bạn nhé... ✨🤗`);
        helpWithTask(task, username).then(help => {
          safeChat(help);
        }).catch(error => {
          console.log('🔧 Lỗi Gemini help:', error);
          safeChat(`Gomen ${username}-chan! Tôi chưa biết cách giúp việc này... (´;ω;) 💔`);
        });
      } else {
        safeChat(`${username}-chan cần giúp gì không? Hãy nói "nghe tớ nè [việc cần làm]" nha! 💕`);
      }
      return;
    }

    if (lowerMessage.includes('tìm rương')) {
      stopCurrentActivity();
      currentMode = 'chest_hunting';
      currentCommand = 'tìm rương';
      lastActivityTime = Date.now();
      safeChat(`Hai ${username}-chan! Tôi sẽ tìm rương xung quanh trong bán kính 32 block! 📦✨`);
      startChestHunting();
      return;
    }

    if (lowerMessage.includes('auto khám phá')) {
      stopCurrentActivity();
      currentMode = 'exploring';
      currentCommand = 'auto khám phá';
      lastActivityTime = Date.now();
      safeChat(`Kyaa~! ${username}-chan! Tôi sẽ khám phá thế giới thông minh! 🗺️✨ Tìm rương, đánh quái, tránh lá cây!`);
      startSmartExplore();
      return;
    }

    if (lowerMessage.includes('auto farm')) {
      stopCurrentActivity();
      const mobMatch = lowerMessage.match(/auto farm (\w+)/);
      if (mobMatch) {
        const mobType = mobMatch[1];
        currentMode = 'autofarming';
        autoFarmTarget = mobType;
        currentCommand = 'auto farm';
        lastActivityTime = Date.now();
        safeChat(`Hai ${username}-chan! Tôi sẽ tự động farm ${mobType}! Với đồ xịn nhất! (ง •̀_•́)ง ✨`);
        startAutoFarm(mobType);
      } else {
        safeChat(`Gomen ${username}-chan! Hãy nói rõ loài sinh vật cần farm! VD: "auto farm spider"`);
      }
      return;
    }

    if (lowerMessage.includes('theo')) {
      stopCurrentActivity();
      const player = bot?.players?.[username];
      if (player && player.entity) {
        currentMode = 'following';
        targetPlayer = player;
        currentCommand = 'theo';
        lastActivityTime = Date.now();
        startFollowing(player);
      } else {
        safeChat(`Gomen ${username}-chan! Tôi không thể tìm thấy bạn! (´;ω;)`);
      }
      return;
    }

    if (lowerMessage.includes('bảo vệ')) {
      stopCurrentActivity();
      const player = bot?.players?.[username];
      if (player && player.entity) {
        currentMode = 'protecting';
        targetPlayer = player;
        currentCommand = 'bảo vệ';
        lastActivityTime = Date.now();
        startProtecting(player);
      } else {
        safeChat(`Gomen ${username}-chan! Tôi không thể tìm thấy bạn để bảo vệ! (´;ω;)`);
      }
      return;
    }
    
    if (lowerMessage.includes('auto mine')) {
      const oreMatch = lowerMessage.match(/auto mine (\w+)/);
      if (oreMatch) {
        const oreType = oreMatch[1].toLowerCase();
        const validOres = ['iron', 'gold', 'diamond', 'copper', 'emerald', 'coal', 'netherite'];
        
        if (validOres.includes(oreType)) {
          stopCurrentActivity();
          currentMode = 'mining';
          miningTarget = oreType;
          currentCommand = `auto mine ${oreType}`;
          lastActivityTime = Date.now();
          
          if (oreType === 'netherite' && bot.game.dimension !== 'the_nether') {
            safeChat(`Gomen ${username}-chan! Netherite chỉ có ở Nether! Tôi đang ở ${bot.game.dimension}! (´;ω;)`);
            return;
          }
          
          safeChat(`Hai ${username}-chan! Tôi sẽ đào ${oreType} ore với cuốc xịn nhất! ⛏️✨`);
          startAutoMining(oreType);
        } else {
          safeChat(`Gomen ${username}-chan! Tôi chỉ có thể đào: ${validOres.join(', ')}! ⛏️`);
        }
      } else {
        safeChat(`${username}-chan! Hãy nói rõ loại quặng! VD: "auto mine iron" ⛏️`);
      }
      return;
    }

    const itemPatterns = [
      /em có (\w+) không/,
      /có (\w+) không/,
      /bot có (\w+) không/,
      /(\w+) có không/,
      /cho (\w+)/,
      /give (\w+)/
    ];
    
    let itemName = null;
    for (const pattern of itemPatterns) {
      const match = lowerMessage.match(pattern);
      if (match && !isWaitingForResponse) {
        itemName = match[1].toLowerCase();
        break;
      }
    }
    
    if (itemName && !isWaitingForResponse) {
      const hasItem = checkInventoryForItem(itemName);
      
      if (hasItem.count > 0) {
        safeChat(`Có nha ${username}-chan! Em có ${hasItem.count} ${itemName}! Anh cần chứ? Em cho luôn! 💕`);
        isWaitingForResponse = true;
        pendingUser = username;
        pendingAction = `give_${itemName}_${hasItem.count}`;
        
        setTimeout(() => {
          if (isWaitingForResponse && pendingUser === username) {
            isWaitingForResponse = false;
            pendingUser = '';
            pendingAction = '';
            safeChat(`${username}-chan không trả lời, em nghĩ anh không cần rồi! (◕‿◕)`);
          }
        }, 30000);
      } else {
        safeChat(`Gomen ${username}-chan! Em không có ${itemName}! (´;ω;) Muốn em tìm cho anh không?`);
      }
      return;
    }

    if (isWaitingForResponse && username === pendingUser) {
      if (lowerMessage.includes('cần') || lowerMessage.includes('cho') || lowerMessage.includes('có') || lowerMessage.includes('yes') || lowerMessage.includes('ok')) {
        const quantityMatch = lowerMessage.match(/(\d+)/);
        const requestedAmount = quantityMatch ? parseInt(quantityMatch[1]) : null;
        
        const actionParts = pendingAction.split('_');
        if (actionParts[0] === 'give') {
          const itemName = actionParts[1];
          const availableAmount = parseInt(actionParts[2]);
          const giveAmount = requestedAmount && requestedAmount <= availableAmount ? requestedAmount : Math.min(10, availableAmount);
          
          safeChat(`Được rồi ${username}-chan! Em sẽ ném ${giveAmount} ${itemName} cho anh! 💕`);
          giveItemToPlayer(username, itemName, giveAmount);
        }
        
        isWaitingForResponse = false;
        pendingUser = '';
        pendingAction = '';
      } else if (lowerMessage.includes('không') || lowerMessage.includes('thôi') || lowerMessage.includes('no')) {
        safeChat(`Được rồi ${username}-chan! Em hiểu rồi! (◕‿◕)♡`);
        isWaitingForResponse = false;
        pendingUser = '';
        pendingAction = '';
      }
      return;
    }

    if (lowerMessage.includes('stop') || lowerMessage.includes('dừng')) {
      // FIX: Lệnh dừng sẽ gọi hàm stopCurrentActivity đã được cải tiến
      stopCurrentActivity();
      lastActivityTime = Date.now();
      safeChat(`Hai ${username}-chan! Tôi đã dừng tất cả hoạt động! (◕‿◕)`);
      return;
    }

    if (lowerMessage.includes('túi đồ') || lowerMessage.includes('inventory') || lowerMessage.includes('đồ của em')) {
      showInventoryToPlayer(username);
      return;
    }

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('chào')) {
      safeChat(`Chào ${username}-chan! (◕‿◕)♡ Rất vui được gặp bạn! UwU`);
    } else if (lowerMessage.includes('dance') || lowerMessage.includes('nhảy')) {
      if (currentMode === 'idle') {
        safeChat('Kyaa~! Tôi sẽ nhảy cho bạn xem! ♪(´▽｀)♪');
        performDance();
      }
    } else if (lowerMessage.includes('cute') || lowerMessage.includes('dễ thương')) {
      safeChat('Arigatou gozaimasu! (///▽///) Bạn cũng rất dễ thương đấy! 💕');
    } else if (message.length > 3 && !lowerMessage.includes('stop') && !lowerMessage.includes('dừng')) {
      generateLoliResponse(message, username).then(response => {
        safeChat(response);
      }).catch(error => {
        console.log('🔧 Lỗi Gemini chat:', error);
        const fallbackResponses = [
          `Hihi ${username}-chan! (◕‿◕)♡`,
          `UwU ${username}-chan nói gì thú vị quá! 💕`,
          `Kyaa~! ${username}-chan làm tôi vui quá! ✨`,
          `Arigatou ${username}-chan! Bạn rất dễ thương! 🌸`
        ];
        const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        safeChat(randomResponse);
      });
    }

  } catch (error) {
    console.log('🔧 Lỗi xử lý user message, bỏ qua...');
  }
}

function updateBotScreen() {
  try {
    if (!bot || !isConnected) return;

    botScreenData.mode = currentMode;
    botScreenData.position = {
      x: Math.round(bot.entity.position.x * 10) / 10,
      y: Math.round(bot.entity.position.y * 10) / 10,
      z: Math.round(bot.entity.position.z * 10) / 10
    };
    botScreenData.health = bot.health || 20;
    botScreenData.food = bot.food || 20;
    botScreenData.equipment = {
      weapon: bot.heldItem?.name || null,
      armor: [
        bot.inventory.slots[5]?.name || null,
        bot.inventory.slots[6]?.name || null,
        bot.inventory.slots[7]?.name || null,
        bot.inventory.slots[8]?.name || null
      ] as (string | null)[]
    };
    botScreenData.lastUpdate = Date.now();
  } catch (error) {
  }
}

function safeStringify(value: any): string {
  try {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (value.toString && typeof value.toString === 'function') return value.toString();
    return JSON.stringify(value);
  } catch (error) {
    return '[Unreadable Object]';
  }
}

function processChatQueue() {
  if (isChatting || chatQueue.length === 0) {
    return;
  }

  isChatting = true;
  const messageToSend = chatQueue.shift();

  if (messageToSend) {
    try {
      bot.chat(messageToSend);
      console.log(`💬 Bot nói: ${messageToSend}`);
    } catch (error) {
      console.log('🔧 Lỗi khi gửi chat từ hàng đợi:', error);
    }
  }

  setTimeout(() => {
    isChatting = false;
    processChatQueue();
  }, CHAT_DELAY);
}

function handleDisconnection(reason: string) {
  isConnected = false;
  stopCurrentActivity();
  console.log(`💔 Bot đã bị ngắt kết nối: ${reason || 'Unknown reason'}`);
  attemptReconnect();
}

function handleBotError(err: Error) {
  console.log(`🔧 Bot error: ${err.message}`);

  const ignoredErrors = [
    'unknown chat format code',
    'chat format',
    'ENOTFOUND',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'socket hang up',
    'ECONNRESET',
    'connection throttled',
    'throttled',
    'failed to connect'
  ];

  const shouldIgnore = ignoredErrors.some(errorType => 
    err.message.toLowerCase().includes(errorType.toLowerCase())
  );

  if (shouldIgnore) {
    console.log('🔧 Lỗi được bỏ qua, bot tiếp tục hoạt động...');
    if (err.message.toLowerCase().includes('throttled') || 
        err.message.toLowerCase().includes('econnreset') ||
        err.message.toLowerCase().includes('failed to connect')) {
      isConnected = false;
      setTimeout(() => {
        attemptReconnect();
      }, 30000);
    }
    return;
  }

  isConnected = false;
  attemptReconnect();
}

function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.log('❌ Đã thử kết nối lại quá nhiều lần. Chờ 120 giây trước khi reset...');
    setTimeout(() => {
      reconnectAttempts = 0;
      console.log('🔄 Reset reconnect counter, thử lại...');
      createBot();
    }, 120000);
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(10000 + (reconnectAttempts * 10000), 60000);
  console.log(`🔄 Thử kết nối lại... (${reconnectAttempts}/${maxReconnectAttempts}) sau ${delay/1000}s`);

  setTimeout(() => {
    createBot();
  }, delay);
}

function startRandomMovement() {
  if (movementInterval) {
    clearInterval(movementInterval);
  }

  movementInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'idle') return;

    try {
      const actions = ['forward', 'back', 'left', 'right', 'jump'] as const;
      const randomAction = actions[Math.floor(Math.random() * actions.length)];

      bot.setControlState(randomAction, true);
      setTimeout(() => {
        if (bot && isConnected && currentMode === 'idle') {
          bot.setControlState(randomAction, false);
        }
      }, 1000 + Math.random() * 2000);
    } catch (error) {
      console.log('🔧 Lỗi di chuyển, bỏ qua...');
    }
  }, 3000 + Math.random() * 5000);
}

function performDance() {
  if (!bot || !isConnected || currentMode !== 'idle') return;

  let danceStep = 0;
  const danceInterval = setInterval(() => {
    if (!isConnected || !bot || danceStep >= 8 || currentMode !== 'idle') {
      clearInterval(danceInterval);
      if (isConnected && bot && currentMode === 'idle') {
        safeChat('Ta-da~! ♪(´▽｀)♪ Vũ điệu hoàn thành! Mọi người có thích không? UwU');
      }
      return;
    }

    try {
      const moves = ['jump', 'left', 'right', 'forward', 'back'] as const;
      const move = moves[danceStep % moves.length];

      bot.setControlState(move, true);
      setTimeout(() => {
        if (bot && isConnected && currentMode === 'idle') {
          bot.setControlState(move, false);
        }
      }, 500);

      danceStep++;
    } catch (error) {
      clearInterval(danceInterval);
      console.log('🔧 Lỗi nhảy múa, dừng...');
    }
  }, 600);
}

process.on('SIGINT', () => {
  console.log('🛑 Đang dừng Bot Lolicute...');
  isConnected = false;
  stopCurrentActivity();

  if (bot) {
    try {
      safeChat('Sayonara minna-san! (◕‿◕)ノ Hẹn gặp lại! 💕');
      setTimeout(() => {
        bot.quit();
        process.exit(0);
      }, CHAT_DELAY + 1000);
    } catch (error) {
      process.exit(0);
    }
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.log('🔧 Uncaught exception được xử lý:', error.message);
  isConnected = false;
  attemptReconnect();
});

process.on('unhandledRejection', (reason) => {
  console.log('🔧 Unhandled rejection được xử lý:', reason);
});

export function getBotScreenData() {
  return botScreenData;
}

export function getBotStatus() {
  return {
    isConnected,
    currentMode,
    targetPlayer: targetPlayer?.username || null,
    reconnectAttempts,
    lastUpdate: Date.now()
  };
}

function startAutoExplore() {
  if (exploringInterval) {
    clearInterval(exploringInterval);
  }

  console.log('🗺️ Bắt đầu khám phá thế giới với AI...');
  safeChat('Bắt đầu cuộc phiêu lưu! Tôi sẽ tìm rương, đánh quái, và lụm đồ! ✨🏃‍♀️');

  equipBestWeapon();
  let isPerformingAction = false;

  exploringInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'exploring') {
      clearInterval(exploringInterval!);
      return;
    }

    try {
      checkInventoryFullness();
      lastActivityTime = Date.now();

      if (isPerformingAction) {
        return;
      }
      isPerformingAction = true;

      const nearbyTargets = findExplorationTargets();
      
      if (nearbyTargets.chests.length > 0 && !isInventoryFull) {
        lootNearestChest(nearbyTargets.chests);
      } else if (nearbyTargets.mobs.length > 0) {
        attackNearestMob(nearbyTargets.mobs);
      } else if (nearbyTargets.drops.length > 0 && !isInventoryFull) {
        collectNearestDrop(nearbyTargets.drops);
      } else {
        exploreRandomDirection();
      }

      setTimeout(() => {
        isPerformingAction = false;
      }, 3000);

      updateBotScreen();
    } catch (error) {
      console.log(`🔧 Lỗi trong exploration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isPerformingAction = false;
    }
  }, 3000);

  startIdleMonitoring();
}

function findExplorationTargets() {
  const position = bot.entity.position;
  const targets = {
    chests: [] as any[],
    mobs: [] as any[],
    drops: [] as any[]
  };

  try {
    for (let x = -20; x <= 20; x += 2) {
      for (let y = -8; y <= 8; y++) {
        for (let z = -20; z <= 20; z += 2) {
          const checkPos = position.offset(x, y, z);
          if (checkPos.y < 30) continue;
          try {
            const block = bot.blockAt(checkPos);
            if (block && (block.name === 'chest' || block.name === 'trapped_chest' || 
                         block.name === 'ender_chest' || block.name === 'shulker_box')) {
              const chestKey = `${Math.floor(checkPos.x)},${Math.floor(checkPos.y)},${Math.floor(checkPos.z)}`;
              if (!exploredChests.has(chestKey)) {
                const distance = position.distanceTo(checkPos);
                targets.chests.push({
                  position: checkPos,
                  distance: distance,
                  key: chestKey,
                  type: block.name
                });
              }
            }
          } catch (blockError) {
            continue;
          }
        }
      }
    }

    Object.values(bot.entities).forEach((entity: any) => {
      if (!entity || !entity.position || entity.id === bot.entity.id) return;
      const distance = position.distanceTo(entity.position);
      if (distance <= 15) {
        const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 
                           'blaze', 'ghast', 'slime', 'magma_cube', 'piglin', 'hoglin', 
                           'vindicator', 'evoker', 'pillager', 'ravager'];
        const mobName = (entity.displayName || entity.name || '').toLowerCase();
        
        if (hostileMobs.some(mob => mobName.includes(mob)) || entity.type === 'hostile') {
          targets.mobs.push({
            entity,
            distance,
            type: entity.displayName || entity.name || 'Unknown Mob'
          });
        }
      }
    });

    Object.values(bot.entities).forEach((entity: any) => {
      if (!entity || !entity.position) return;
      const distance = position.distanceTo(entity.position);
      if (distance <= 12 && entity.name === 'item') {
        targets.drops.push({
          entity,
          distance,
          item: entity.getDroppedItem?.() || 'Unknown Item'
        });
      }
    });

    targets.chests.sort((a, b) => a.distance - b.distance);
    targets.mobs.sort((a, b) => a.distance - b.distance);
    targets.drops.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.log(`🔧 Lỗi tìm targets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  return targets;
}

function lootNearestChest(chests: any[]) {
  if (!chests.length) return;
  const nearestChest = chests[0];
  console.log(`📦 Tìm thấy ${nearestChest.type} tại (${Math.floor(nearestChest.position.x)}, ${Math.floor(nearestChest.position.y)}, ${Math.floor(nearestChest.position.z)})! Đang loot...`);
  safeChat(`Kyaa! Tìm thấy ${nearestChest.type}! Có gì hay ho không nhỉ? 📦✨`);

  try {
    bot.clearControlStates();
    if (bot.pathfinder && goals) {
      const goal = new goals.GoalBlock(
        Math.floor(nearestChest.position.x),
        Math.floor(nearestChest.position.y),
        Math.floor(nearestChest.position.z)
      );
      bot.pathfinder.setGoal(goal);
      bot.pathfinder.on('goal_reached', async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const chest = bot.blockAt(nearestChest.position);
          if (!chest) {
            exploredChests.add(nearestChest.key);
            return;
          }
          const window = await bot.openChest(chest);
          let itemCount = 0;
          for (let i = 0; i < window.slots.length; i++) {
            const item = window.slots[i];
            if (item && bot.inventory.emptySlotCount() > 2) {
              await window.withdraw(item.type, null, item.count);
              itemCount += item.count;
            }
          }
          window.close();
          exploredChests.add(nearestChest.key);
          if (itemCount > 0) {
            safeChat(`Loot xong rương! Lấy được ${itemCount} đồ hay! (◕‿◕)♡`);
          } else {
            safeChat('Rương rỗng hoặc túi đầy rồi! (╥﹏╥)');
          }
        } catch (openError) {
          exploredChests.add(nearestChest.key);
        }
      });
    }
  } catch (error) {
    console.log(`🔧 Lỗi loot chest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    exploredChests.add(nearestChest.key);
  }
}

function attackNearestMob(mobs: any[]) {
  if (!mobs.length) return;
  const nearestMob = mobs[0];
  console.log(`⚔️ Tấn công ${nearestMob.type}!`);
  
  const now = Date.now();
  if (now - lastCombatChatTime > 5000) {
    safeChat(`Quái ${nearestMob.type}! Coi chừng nhé! (ง •̀_•́)ง✨`);
    lastCombatChatTime = now;
  }
  
  try {
    equipBestWeapon();
    bot.attack(nearestMob.entity);
    if (bot.pathfinder) {
      bot.pathfinder.setGoal(new goals.GoalFollow(nearestMob.entity, 1));
    }
    botScreenData.status = `Đang tấn công ${nearestMob.type}`;
  } catch (error) {
    console.log('🔧 Lỗi attack mob');
  }
}

function collectNearestDrop(drops: any[]) {
  if (!drops.length) return;
  const nearestDrop = drops[0];
  console.log(`💎 Thu thập đồ rơi: ${nearestDrop.item || 'Unknown Item'} (${nearestDrop.distance.toFixed(1)}m)...`);
  safeChat(`Uwaa! Có đồ rơi! Lụm đi nào! 💎✨ ${nearestDrop.item || 'Cái gì đó'}`);

  try {
    bot.clearControlStates();
    if (bot.pathfinder && goals && nearestDrop.entity) {
      const goal = new goals.GoalFollow(nearestDrop.entity, 0.5);
      bot.pathfinder.setGoal(goal);
    }
    botScreenData.status = `Thu thập: ${nearestDrop.item || 'đồ rơi'}`;
  } catch (error) {
    console.log(`🔧 Lỗi collect drop: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function exploreRandomDirection() {
  try {
    if (!bot || !bot.entity || !bot.entity.position) {
      return;
    }
    const position = bot.entity.position;
    const directions = [
      { x: 20, z: 0 }, { x: -20, z: 0 }, { x: 0, z: 20 }, { x: 0, z: -20 },
      { x: 15, z: 15 }, { x: -15, z: 15 }, { x: 15, z: -15 }, { x: -15, z: -15 }
    ];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const targetPos = {
      x: position.x + randomDir.x,
      y: position.y,
      z: position.z + randomDir.z
    };
    for (let y = Math.max(targetPos.y - 10, 40); y <= targetPos.y + 10; y++) {
      try {
        const checkBlock = bot.blockAt({ x: targetPos.x, y: y, z: targetPos.z });
        const aboveBlock = bot.blockAt({ x: targetPos.x, y: y + 1, z: targetPos.z });
        if (checkBlock && checkBlock.name !== 'air' && 
            aboveBlock && aboveBlock.name === 'air') {
          targetPos.y = y + 1;
          break;
        }
      } catch (blockError) {
        continue;
      }
    }
    if (bot.pathfinder && goals && goals.GoalNear) {
      bot.pathfinder.setGoal(new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 1));
    }
    botScreenData.status = `Khám phá hướng (${targetPos.x}, ${targetPos.z})`;
  } catch (error) {
    console.log(`🔧 Lỗi explore direction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    const actions = ['forward', 'left', 'right'] as const;
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    bot.setControlState(randomAction, true);
    setTimeout(() => {
      bot.setControlState(randomAction, false);
    }, 2000);
  }
}

function equipBestWeapon() {
  try {
    const weapons = ['netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword'];
    for (const weapon of weapons) {
      const item = bot.inventory.findInventoryItem(weapon);
      if (item) {
        bot.equip(item, 'hand');
        console.log(`⚔️ Trang bị ${weapon}`);
        botScreenData.equipment.weapon = weapon;
        return;
      }
    }
  } catch (error) {
    console.log('🔧 Lỗi equip weapon');
  }
}

function checkInventoryFullness() {
  try {
    const emptySlots = bot.inventory.emptySlotCount();
    isInventoryFull = emptySlots <= 3;
    if (isInventoryFull && currentMode === 'exploring') {
      safeChat('Túi đồ đầy rồi! Chuyển sang chế độ giết quái thôi! (ง •̀_•́)ง💪');
    }
    botScreenData.status = isInventoryFull ? 'Túi đầy - Combat mode' : 'Đang khám phá';
  } catch (error) {
    console.log('🔧 Lỗi check inventory');
  }
}

function startIdleMonitoring() {
  if (selfDefenseInterval) {
    clearInterval(selfDefenseInterval);
  }
  selfDefenseInterval = setInterval(() => {
    if (!isConnected || !bot) {
      clearInterval(selfDefenseInterval!);
      return;
    }
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    if (timeSinceLastActivity >= IDLE_TIMEOUT && currentMode === 'idle') {
      console.log('🛡️ Kích hoạt chế độ tự vệ sau 3 phút idle');
      safeChat('Đã 3 phút rồi! Tôi sẽ tự bảo vệ bản thân khỏi quái! 🛡️⚔️');
      currentMode = 'self_defense';
      startSelfDefense();
    }
  }, 30000);
}

function startSelfDefense() {
  console.log('🛡️ Bắt đầu chế độ tự vệ...');
  
  const selfDefenseLoop = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'self_defense') {
      clearInterval(selfDefenseLoop);
      return;
    }

    try {
      equipBestWeapon();
      const nearbyThreats = findNearbyThreats();
      
      if (nearbyThreats.length > 0) {
        const nearestThreat = nearbyThreats[0];
        console.log(`🛡️ Tự vệ khỏi ${nearestThreat.type}!`);
        safeChat(`${nearestThreat.type} đến gần! Tôi phải tự vệ! (ง •̀_•́)ง`);
        
        bot.attack(nearestThreat.entity);
        if (bot.pathfinder) {
          bot.pathfinder.setGoal(new goals.GoalFollow(nearestThreat.entity, 1));
        }
        
        botScreenData.status = `Tự vệ khỏi ${nearestThreat.type}`;
      } else {
        bot.pathfinder.setGoal(null);
        performDefensiveMovement();
        botScreenData.status = 'Chế độ tự vệ - An toàn';
      }
      updateBotScreen();
    } catch (error) {
      console.log('🔧 Lỗi self defense:', error.message);
    }
  }, 2000);
}

function findNearbyThreats() {
  const threats: any[] = [];
  const position = bot.entity.position;
  try {
    Object.values(bot.entities).forEach((entity: any) => {
      if (!entity || !entity.position) return;
      const distance = position.distanceTo(entity.position);
      if (distance <= 8 && (entity.displayName || entity.name)) {
        const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch'];
        const mobName = entity.displayName || entity.name || '';
        if (hostileMobs.some(mob => mobName.toLowerCase().includes(mob))) {
          threats.push({
            entity,
            distance,
            type: mobName
          });
        }
      }
    });
    threats.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.log('🔧 Lỗi find threats');
  }
  return threats;
}

function performDefensiveMovement() {
  try {
    const actions = ['left', 'right', 'jump'] as const;
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    bot.setControlState(randomAction, true);
    setTimeout(() => {
      bot.setControlState(randomAction, false);
    }, 1000);
    const randomYaw = Math.random() * Math.PI * 2;
    bot.look(randomYaw, 0);
  } catch (error) {
    console.log('🔧 Lỗi defensive movement');
  }
}

function checkInventoryForItem(itemName: string) {
  try {
    let totalCount = 0;
    let foundItems: any[] = [];
    const itemAliases: { [key: string]: string[] } = {
      'iron': ['iron_ingot', 'iron_ore', 'raw_iron'],
      'gold': ['gold_ingot', 'gold_ore', 'raw_gold'],
      'diamond': ['diamond', 'diamond_ore'],
      'coal': ['coal', 'coal_ore'],
      'stone': ['stone', 'cobblestone'],
      'wood': ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log'],
      'food': ['bread', 'apple', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken'],
      'tool': ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']
    };
    const searchTerms = itemAliases[itemName] || [itemName];
    for (const item of bot.inventory.items()) {
      const itemFullName = (item.name || '').toLowerCase();
      const itemDisplayName = (item.displayName || '').toLowerCase();
      const matchesSearch = searchTerms.some(term => 
        itemFullName.includes(term) || 
        itemDisplayName.includes(term) ||
        itemFullName === term
      );
      if (matchesSearch) {
        totalCount += item.count;
        foundItems.push(item);
      }
    }
    return {
      count: totalCount,
      items: foundItems,
      hasItem: totalCount > 0
    };
  } catch (error) {
    console.log('🔧 Lỗi check inventory:', error);
    return { count: 0, items: [], hasItem: false };
  }
}

function giveItemToPlayer(username: string, itemName: string, amount: number) {
  try {
    const player = bot.players[username];
    if (!player || !player.entity) {
      safeChat(`${username}-chan không gần đây! Em không ném được! (´;ω;)`);
      return;
    }
    const itemCheck = checkInventoryForItem(itemName);
    if (!itemCheck.hasItem || itemCheck.count < amount) {
      safeChat(`Gomen ${username}-chan! Em không đủ ${itemName}! Chỉ có ${itemCheck.count}! (´;ω;)`);
      return;
    }
    let remainingAmount = amount;
    for (const item of itemCheck.items) {
      if (remainingAmount <= 0) break;
      const tossAmount = Math.min(remainingAmount, item.count);
      bot.toss(item.type, null, tossAmount);
      remainingAmount -= tossAmount;
      console.log(`🎁 Ném ${tossAmount} ${item.name} cho ${username}`);
    }
    safeChat(`Đã ném ${amount} ${itemName} cho ${username}-chan rồi! Lụm nhanh nhé! 💕`);
  } catch (error) {
    console.log(`🔧 Lỗi give item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    safeChat(`Gomen ${username}-chan! Em không ném được đồ! (´;ω;)`);
  }
}

function equipBestPickaxe() {
  try {
    const pickaxes = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
    for (const pickaxe of pickaxes) {
      const item = bot.inventory.findInventoryItem(pickaxe);
      if (item) {
        bot.equip(item, 'hand');
        console.log(`⛏️ Trang bị ${pickaxe}`);
        botScreenData.equipment.weapon = pickaxe;
        return pickaxe;
      }
    }
    console.log('⛏️ Không tìm thấy cuốc nào');
    return null;
  } catch (error) {
    console.log('🔧 Lỗi equip pickaxe');
    return null;
  }
}

function startAutoMining(oreType: string) {
  if (miningInterval) {
    clearInterval(miningInterval);
  }
  console.log(`⛏️ Bắt đầu đào ${oreType} ore...`);
  const pickaxe = equipBestPickaxe();
  if (!pickaxe) {
    safeChat('Em không có cuốc để đào! (´;ω;) Cần anh cho em cuốc!');
    return;
  }
  miningInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'mining') {
      clearInterval(miningInterval!);
      return;
    }
    try {
      checkInventoryFullness();
      lastActivityTime = Date.now();
      const nearbyOres = findNearbyOres(oreType);
      if (nearbyOres.length > 0) {
        mineNearestOre(nearbyOres[0]);
      } else {
        exploreForOres(oreType);
      }
      updateBotScreen();
    } catch (error) {
      console.log(`🔧 Lỗi trong mining: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, 2000);
}

function findNearbyOres(oreType: string) {
  const position = bot.entity.position;
  const ores: any[] = [];
  try {
    const oreBlocks: { [key: string]: string[] } = {
      'iron': ['iron_ore', 'deepslate_iron_ore'],
      'gold': ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
      'diamond': ['diamond_ore', 'deepslate_diamond_ore'],
      'copper': ['copper_ore', 'deepslate_copper_ore'],
      'emerald': ['emerald_ore', 'deepslate_emerald_ore'],
      'coal': ['coal_ore', 'deepslate_coal_ore'],
      'netherite': ['ancient_debris']
    };
    const targetBlocks = oreBlocks[oreType] || [];
    for (let x = -10; x <= 10; x++) {
      for (let y = -5; y <= 5; y++) {
        for (let z = -10; z <= 10; z++) {
          const checkPos = position.offset(x, y, z);
          try {
            const block = bot.blockAt(checkPos);
            if (block && targetBlocks.includes(block.name)) {
              const distance = position.distanceTo(checkPos);
              ores.push({
                position: checkPos,
                distance: distance,
                type: block.name
              });
            }
          } catch (blockError) {
            continue;
          }
        }
      }
    }
    ores.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.log(`🔧 Lỗi tìm ore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  return ores;
}

function mineNearestOre(ore: any) {
  console.log(`⛏️ Đào ${ore.type} tại (${Math.floor(ore.position.x)}, ${Math.floor(ore.position.y)}, ${Math.floor(ore.position.z)})`);
  try {
    if (bot.pathfinder && goals) {
      const goal = new goals.GoalBlock(
        Math.floor(ore.position.x),
        Math.floor(ore.position.y),
        Math.floor(ore.position.z)
      );
      bot.pathfinder.setGoal(goal);
    }
    setTimeout(async () => {
      try {
        const block = bot.blockAt(ore.position);
        if (block && (block.name.includes('ore') || block.name === 'ancient_debris')) {
          await bot.dig(block);
          console.log(`✅ Đã đào xong ${block.name}`);
          safeChat(`Đào được ${block.name}! Yay! ⛏️✨`);
        }
      } catch (digError) {
        console.log(`🔧 Lỗi đào block: ${digError instanceof Error ? digError.message : 'Unknown error'}`);
      }
    }, 2000);
    botScreenData.status = `Đang đào ${ore.type}`;
  } catch (error) {
    console.log(`🔧 Lỗi mine ore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function exploreForOres(oreType: string) {
  try {
    const position = bot.entity.position;
    let targetY = position.y;
    const optimalYLevels: { [key: string]: number } = {
      'iron': 15,
      'gold': 15,
      'diamond': -54,
      'copper': 48,
      'emerald': -54,
      'coal': 96,
      'netherite': 15
    };
    targetY = optimalYLevels[oreType] || position.y;
    const directions = [
      { x: 10, z: 0 }, { x: -10, z: 0 }, { x: 0, z: 10 }, { x: 0, z: -10 }
    ];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const targetPos = {
      x: position.x + randomDir.x,
      y: targetY,
      z: position.z + randomDir.z
    };
    if (bot.pathfinder && goals) {
      bot.pathfinder.setGoal(new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 1));
    }
    botScreenData.status = `Tìm ${oreType} ore tại Y=${targetY}`;
  } catch (error) {
    console.log(`🔧 Lỗi explore for ores: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function showInventoryToPlayer(username: string) {
  try {
    const items = bot.inventory.items();
    if (items.length === 0) {
      safeChat(`${username}-chan! Em không có đồ gì cả! (´;ω;) Túi rỗng luôn!`);
      return;
    }
    const itemGroups: { [key: string]: number } = {};
    for (const item of items) {
      const itemName = item.displayName || item.name;
      itemGroups[itemName] = (itemGroups[itemName] || 0) + item.count;
    }
    const itemList = Object.entries(itemGroups)
      .slice(0, 5)
      .map(([name, count]) => `${name} x${count}`)
      .join(', ');
    const totalItems = items.reduce((sum, item) => sum + item.count, 0);
    const totalSlots = items.length;
    safeChat(`${username}-chan! Em có ${totalItems} đồ (${totalSlots} loại): ${itemList}${Object.keys(itemGroups).length > 5 ? '...' : ''}! Cần gì thì hỏi em nhé! 💕`);
  } catch (error) {
    console.log('🔧 Lỗi show inventory:', error);
    safeChat(`${username}-chan! Em không xem được túi đồ! (´;ω;)`);
  }
}

function startHealthRecovery() {
  try {
    safeChat('Chế độ phục hồi máu! Tôi sẽ tìm chỗ an toàn và ăn để hồi máu! 🏥');
    currentMode = 'health_recovery';
    bot.clearControlStates();
    attemptSelfFeeding();
    const threats = findNearbyThreats();
    if (threats.length > 0) {
      runAwayFromThreats(threats);
    } else {
      findSafeSpot();
    }
  } catch (error) {
    console.log('🔧 Lỗi health recovery...');
  }
}

function resumePreviousActivity() {
  if (previousActivity && previousActivity !== 'idle') {
    safeChat(`Khỏe rồi! Tôi sẽ tiếp tục ${previousActivity}! (◕‿◕)♡`);
    currentMode = previousActivity;
    lastActivityTime = Date.now();
    switch (previousActivity) {
      case 'following':
        if (targetPlayer) startFollowing(targetPlayer);
        break;
      case 'protecting': 
        if (targetPlayer) startProtecting(targetPlayer);
        break;
      case 'exploring':
        startSmartExplore();
        break;
      case 'mining':
        if (miningTarget) startAutoMining(miningTarget);
        break;
      case 'autofarming':
        if (autoFarmTarget) startAutoFarm(autoFarmTarget);
        break;
    }
    previousActivity = 'idle';
  }
}

function attemptSelfFeeding() {
  try {
    const foods = bot.inventory.items().filter((item: any) => {
      const foodItems = ['bread', 'apple', 'carrot', 'potato', 'cooked_beef', 'cooked_porkchop', 
                        'cooked_chicken', 'cooked_salmon', 'cooked_cod', 'cookie', 'cake'];
      return foodItems.some(food => item.name.includes(food));
    });
    if (foods.length > 0) {
      const food = foods[0];
      bot.equip(food, 'hand');
      bot.consume();
      safeChat(`Đang ăn ${food.displayName || food.name}! Om nom nom! (◕‿◕)`);
      console.log(`🍖 Bot đang ăn ${food.name}`);
    } else {
      safeChat('Không có đồ ăn! Ai có thức ăn không ạ? (´;ω;)');
    }
  } catch (error) {
    console.log('🔧 Lỗi self feeding...');
  }
}

function runAwayFromThreats(threats: any[]) {
  try {
    const nearestThreat = threats[0];
    const botPos = bot.entity.position;
    const threatPos = nearestThreat.entity.position;
    const escapeX = botPos.x - threatPos.x;
    const escapeZ = botPos.z - threatPos.z;
    const distance = Math.sqrt(escapeX*escapeX + escapeZ*escapeZ);
    if (distance > 0) {
      const normalizedX = escapeX / distance;
      const normalizedZ = escapeZ / distance;
      if (normalizedX > 0.5) bot.setControlState('forward', true);
      else if (normalizedX < -0.5) bot.setControlState('back', true);
      if (normalizedZ > 0.5) bot.setControlState('left', true);
      else if (normalizedZ < -0.5) bot.setControlState('right', true);
      bot.setControlState('sprint', true);
      safeChat(`Chạy khỏi ${nearestThreat.type}! Máu thấp quá! (>_<)`);
    }
  } catch (error) {
    console.log('🔧 Lỗi run away...');
  }
}

function findSafeSpot() {
  try {
    const position = bot.entity.position;
    const directions = [
      { x: 10, z: 0 }, { x: -10, z: 0 }, { x: 0, z: 10 }, { x: 0, z: -10 }
    ];
    for (const dir of directions) {
      const checkPos = {
        x: position.x + dir.x,
        y: position.y,
        z: position.z + dir.z
      };
      if (bot.pathfinder && goals) {
        bot.pathfinder.setGoal(new goals.GoalNear(checkPos.x, checkPos.y, checkPos.z, 2));
        break;
      }
    }
    safeChat('Đang tìm chỗ an toàn để hồi máu...');
  } catch (error) {
    console.log('🔧 Lỗi find safe spot...');
  }
}

function returnToDroppedItems() {
  try {
    if (!droppedItemsLocation) return;
    safeChat('Quay lại lụm đồ rớt! Chờ tôi nhé! (◕‿◕)');
    currentMode = 'item_recovery';
    if (bot.pathfinder && goals) {
      const goal = new goals.GoalNear(
        droppedItemsLocation.x,
        droppedItemsLocation.y,
        droppedItemsLocation.z,
        3
      );
      bot.pathfinder.setGoal(goal);
      setTimeout(() => {
        if (currentMode === 'item_recovery') {
          safeChat('Hết thời gian tìm đồ rớt! Có thể đã despawn rồi! (´;ω;)');
          stopCurrentActivity();
          droppedItemsLocation = null;
        }
      }, 30000);
    }
  } catch (error) {
    console.log('🔧 Lỗi return to drops...');
  }
}

function startSmartExplore() {
  if (exploringInterval) {
    clearInterval(exploringInterval);
  }
  safeChat('Bắt đầu khám phá thông minh! Tránh lá cây, dùng tools hợp lý! 🗺️✨');
  exploringInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'exploring') {
      clearInterval(exploringInterval!);
      return;
    }
    try {
      if (bot.health <= 6 || bot.food <= 6) {
        safeChat('Cần nghỉ ngơi! Dừng khám phá để chăm sóc bản thân!');
        stopCurrentActivity();
        return;
      }
      equipBestGear();
      const targets = findSmartExplorationTargets();
      if (targets.chests.length > 0) {
        lootNearestChest(targets.chests);
      } else if (targets.drops.length > 0 && !isInventoryFull) {
        collectNearestDrop(targets.drops);
      } else if (targets.mobs.length > 0) {
        attackNearestMob(targets.mobs);
      } else {
        exploreIntelligently();
      }
      updateBotScreen();
    } catch (error) {
      console.log('🔧 Lỗi smart explore...');
    }
  }, 3000);
}

function exploreIntelligently() {
  exploreRandomDirection();
}

function equipBestGear() {
  try {
    if (!bot || !bot.inventory) return;
    const swords = bot.inventory.items().filter((item: any) => 
      item.name.includes('sword')
    );
    const bestSword = swords.reduce((best: any, current: any) => {
      const swordPriority: any = {
        'diamond_sword': 3,
        'iron_sword': 2,
        'stone_sword': 1,
        'wooden_sword': 0
      };
      const bestPriority = swordPriority[best?.name] || 0;
      const currentPriority = swordPriority[current?.name] || 0;
      return currentPriority > bestPriority ? current : best;
    }, null);
    if (bestSword && bot.heldItem?.name !== bestSword.name) {
      bot.equip(bestSword, 'hand');
      safeChat(`Equipped ${bestSword.name}! Ready for battle! ⚔️`);
    }
    const armorPieces = ['helmet', 'chestplate', 'leggings', 'boots'];
    const armorPriority: any = {
      'diamond': 3,
      'iron': 2,
      'chainmail': 1,
      'leather': 0
    };
    armorPieces.forEach(piece => {
      const armorItems = bot.inventory.items().filter((item: any) => 
        item.name.includes(piece)
      );
      const bestArmor = armorItems.reduce((best: any, current: any) => {
        let bestPriority = 0;
        let currentPriority = 0;
        for (const material in armorPriority) {
          if (best?.name.includes(material)) {
            bestPriority = armorPriority[material];
          }
          if (current?.name.includes(material)) {
            currentPriority = armorPriority[material];
          }
        }
        return currentPriority > bestPriority ? current : best;
      }, null);
      if (bestArmor) {
        const equipSlot = piece === 'helmet' ? 'head' : 
                        piece === 'chestplate' ? 'torso' :
                        piece === 'leggings' ? 'legs' : 'feet';
        bot.equip(bestArmor, equipSlot);
      }
    });
  } catch (error) {
    console.log('🔧 Lỗi trang bị đồ...');
  }
}

function startAutoEquipment() {
  if (equipmentCheckInterval) {
    clearInterval(equipmentCheckInterval);
  }
  equipmentCheckInterval = setInterval(() => {
    if (!bot || !isConnected) {
      clearInterval(equipmentCheckInterval!);
      return;
    }
    try {
      equipBestGear();
    } catch (error) {
      console.log('🔧 Lỗi tự động trang bị...');
    }
  }, 5000);
}

function findSmartExplorationTargets() {
  const targets = {
    chests: [] as any[],
    drops: [] as any[],
    mobs: [] as any[]
  };
  try {
    const position = bot.entity.position;
    Object.values(bot.entities).forEach((entity: any) => {
      if (!entity || !entity.position) return;
      const distance = position.distanceTo(entity.position);
      if (distance > 32) return;
      if (entity.objectType === 'Item') {
        targets.drops.push({
          entity,
          distance,
          item: entity.displayName || 'Unknown Item'
        });
      } else if (entity.type === 'mob' || entity.type === 'hostile') {
        targets.mobs.push({
          entity,
          distance,
          type: entity.displayName || entity.name || 'Unknown Mob'
        });
      }
    });
    for (let x = -16; x <= 16; x += 4) {
      for (let z = -16; z <= 16; z += 4) {
        for (let y = -8; y <= 8; y += 2) {
          const checkPos = position.offset(x, y, z);
          const block = bot.blockAt(checkPos);
          if (block && (block.name.includes('chest') || block.name.includes('barrel'))) {
            const distance = position.distanceTo(checkPos);
            targets.chests.push({
              position: checkPos,
              distance,
              type: block.name,
              block
            });
          }
        }
      }
    }
    targets.chests.sort((a, b) => a.distance - b.distance);
    targets.drops.sort((a, b) => a.distance - b.distance);
    targets.mobs.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.log('🔧 Lỗi find smart targets...');
  }
  return targets;
}

function startChestHunting() {
  if (movementInterval) {
    clearInterval(movementInterval);
  }
  safeChat('Bắt đầu săn rương! Tìm trong bán kính 32 blocks! 📦🔍');
  movementInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'chest_hunting') {
      clearInterval(movementInterval!);
      return;
    }
    try {
      const chests = findNearbyChests();
      if (chests.length > 0) {
        const nearestChest = chests[0];
        safeChat(`Tìm thấy rương cách ${nearestChest.distance.toFixed(1)}m! Đang tiến đến! 📦✨`);
        lootNearestChest([nearestChest]);
      } else {
        exploreForChests();
      }
      updateBotScreen();
    } catch (error) {
      console.log('🔧 Lỗi chest hunting...');
    }
  }, 3000);
}

function findNearbyChests() {
  const chests: any[] = [];
  const position = bot.entity.position;
  const chestSearchRadius = 32;
  try {
    for (let x = -chestSearchRadius; x <= chestSearchRadius; x += 16) {
      for (let z = -chestSearchRadius; z <= chestSearchRadius; z += 16) {
        for (let y = position.y - 16; y <= position.y + 16; y++) {
          const checkPos = { x: position.x + x, y: y, z: position.z + z };
          const block = bot.blockAt(checkPos);
          if (block && (block.name.includes('chest') || block.name.includes('shulker'))) {
            const distance = position.distanceTo(checkPos);
            if (distance <= chestSearchRadius) {
              chests.push({
                position: checkPos,
                distance: distance,
                type: block.name,
                block: block
              });
            }
          }
        }
      }
    }
    chests.sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.log('🔧 Lỗi find chests...');
  }
  return chests;
}

function exploreForChests() {
  try {
    const directions = [
      { x: 16, z: 0 }, { x: 0, z: 16 }, { x: -16, z: 0 }, { x: 0, z: -16 },
      { x: 16, z: 16 }, { x: -16, z: 16 }, { x: 16, z: -16 }, { x: -16, z: -16 }
    ];
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const position = bot.entity.position;
    const targetPos = {
      x: position.x + randomDir.x,
      y: position.y,
      z: position.z + randomDir.z
    };
    if (bot.pathfinder && goals) {
      bot.pathfinder.setGoal(new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 2));
    }
    botScreenData.status = `Tìm rương tại (${targetPos.x}, ${targetPos.z})`;
  } catch (error) {
    console.log('🔧 Lỗi explore for chests...');
  }
}

async function answerQuestion(question: string, username: string) {
  try {
    return `${username}-chan! Câu hỏi hay quá! Về "${question}", tôi nghĩ... hmm... Tôi cần học thêm để trả lời tốt hơn! (◕‿◕)♡`;
  } catch (error) {
    console.log('🔧 Lỗi answer question...');
    throw error;
  }
}

async function helpWithTask(task: string, username: string) {
  try {
    return `${username}-chan! Để làm "${task}", tôi suggest: Bước 1: Chuẩn bị nguyên liệu. Bước 2: Lên kế hoạch. Bước 3: Thực hiện từng bước nhỏ! Chúc bạn thành công! ✨`;
  } catch (error) {
    console.log('🔧 Lỗi help with task...');
    throw error;
  }
}

async function generateLoliResponse(message: string, username: string) {
  try {
    const responses = [
      `${username}-chan nói hay quá! (◕‿◕)♡`,
      `UwU ${username}-chan! Bạn làm tôi vui quá! 💕`,
      `Kyaa~! ${username}-chan thật dễ thương! ✨`,
      `Hihi! ${username}-chan luôn biết cách làm tôi cười! 🌸`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  } catch (error) {
    console.log('🔧 Lỗi generate loli response...');
    throw error;
  }
}

// Bổ sung các hàm phụ trợ
function patrolAroundPlayer(player: any) {}
function moveAwayFromTarget(botPos: any, targetPos: any, distance: number) {}
function moveTowardsPlayerPrecise(botPos: any, playerPos: any, targetDistance: number) {}
function moveTowardsPlayer(botPos: any, playerPos: any) {}

