// ==================== Cấu hình và Imports ====================
import mineflayer from 'mineflayer';
import * as pathfinderPlugin from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPlugin;

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

if (global[PROCESS_LOCK_KEY]) {
  console.log('⚠️ Bot process khác đã đang chạy, thoát để tránh duplicate login...');
  process.exit(0);
}

if (process.env.BOT_DISABLED === 'true') {
  console.log('🚫 Bot bị tắt do chạy trong web server process');
  process.exit(0);
}

const startDelay = Math.random() * 3000;
setTimeout(() => {
  if (global[PROCESS_LOCK_KEY] && global[PROCESS_LOCK_KEY] !== processStartTime) {
    console.log('⚠️ Process khác đã khởi động bot, thoát...');
    process.exit(0);
  }
  
  console.log('🚀 Đang khởi động Bot Lolicute...');
  startBot();
}, startDelay);

global[PROCESS_LOCK_KEY] = processStartTime;

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

let bot: any = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 7;
let movementInterval: NodeJS.Timeout | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;

const HEALTH_CHECK_DELAY = 10000;
let currentMode = 'idle';
let targetPlayer: any = null;
let followingInterval: NodeJS.Timeout | null = null;
let protectingInterval: NodeJS.Timeout | null = null;
let currentCommand = '';
let autoFarmTarget = '';
let autoFarmInterval: NodeJS.Timeout | null = null;
let equipmentCheckInterval: NodeJS.Timeout | null = null;

let exploringInterval: NodeJS.Timeout | null = null;
let selfDefenseInterval: NodeJS.Timeout | null = null;
let exploredChests: Set<string> = new Set();
let isInventoryFull = false;
let lastActivityTime = Date.now();

let miningInterval: NodeJS.Timeout | null = null;
let miningTarget = '';
let isWaitingForResponse = false;
let pendingUser = '';
let pendingAction = '';

let lastCombatChatTime = 0;
const IDLE_TIMEOUT = 3 * 60 * 1000;

let botScreenData = {
  mode: 'idle',
  position: { x: 0, y: 0, z: 0 },
  health: 20,
  food: 20,
  targetPlayer: null,
  nearbyMobs: [] as any[],
  equipment: {
    weapon: null,
    armor: []
  },
  status: 'Đang chờ lệnh...',
  lastUpdate: Date.now()
};

const chatQueue: string[] = [];
let isChatting = false;
const CHAT_DELAY = 4000;
let lastChatTime = 0;

let previousActivity = 'idle';
let droppedItemsLocation: any = null;
let originalGameMode = 'survival';
let isFlying = false;

let defaultMovements: Movements;
let creeperAvoidanceMode = false;


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

function startBot() {
  createBot();
}

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

function stopCurrentActivity() {
  console.log(`🛑 Dừng hoạt động hiện tại: ${currentMode} -> idle`);
  
  const oldMode = currentMode;
  currentMode = 'idle';
  targetPlayer = null;
  currentCommand = '';
  autoFarmTarget = '';
  previousActivity = 'idle';

  clearAllIntervalsAndPathfinder();

  try {
    if (bot && isConnected) {
      bot.clearControlStates();
    }
  } catch (error) {
    console.log('🔧 Lỗi dừng movement controls...');
  }
  updateBotScreen();
  console.log(`✅ Đã dừng hoạt động ${oldMode} thành công`);
}

function clearAllIntervalsAndPathfinder() {
  if (bot && bot.pathfinder) {
    bot.pathfinder.setGoal(null);
  }

  const intervals = [
    movementInterval, followingInterval, protectingInterval, 
    autoFarmInterval, equipmentCheckInterval, exploringInterval, 
    selfDefenseInterval, miningInterval, healthCheckInterval
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
  healthCheckInterval = null;
}

// ==================== Thiết lập Events của Bot ====================
function setupBotEvents() {
  if (!bot) return;

  bot.on('spawn', () => {
    isConnected = true;
    reconnectAttempts = 0;
    console.log('💕 Bot Lolicute đã tham gia server! Konnichiwa minna-san! UwU');

    bot.loadPlugin(pathfinder);
    defaultMovements = new Movements(bot);
    bot.pathfinder.setMovements(defaultMovements);

    setTimeout(() => {
      safeChat('Chào mừng đến với bot loli! 💕 Tôi là bot dễ thương của bạn! (◕‿◕)♡');
    }, 2000);

    updateBotScreen();
    botScreenData.status = 'Đã kết nối thành công!';
    lastActivityTime = Date.now();
    startRandomMovement();
    startIdleMonitoring();
    startHealthCheck();
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

function startFollowing(player: any) {
  stopCurrentActivity();
  if (!bot.pathfinder || !player?.entity) {
    safeChat('Gomen! Pathfinder chưa sẵn sàng để theo dõi bạn! (´;ω;)');
    return;
  }
  console.log(`🏃 Bắt đầu theo dõi ${player.username}`);
  safeChat(`Hai ${player.username}-chan! Tôi sẽ theo bạn đi khắp nơi! ε=ε=ε=┌(˘▾˘)┘`);
  currentMode = 'following';

  const followDistance = 2.0;
  const goal = new goals.GoalFollow(player.entity, followDistance);
  bot.pathfinder.setGoal(goal, true);

  followingInterval = setInterval(() => {
    if (!isConnected || !bot || !player || !player.entity || currentMode !== 'following') {
      clearInterval(followingInterval!);
      stopCurrentActivity();
      return;
    }
    const distance = bot.entity.position.distanceTo(player.entity.position);
    botScreenData.targetPlayer = player.username;
    botScreenData.status = `Đang theo dõi ${player.username} (${distance.toFixed(1)}m)`;

    if (distance > 20) {
      safeChat('Kyaa~! Bạn đi quá xa rồi! Tôi sẽ teleport đến! ✨');
      bot.chat(`/tp ${player.username}`);
      botScreenData.status = `Teleport đến ${player.username}`;
    }
    updateBotScreen();
  }, 500);
}

function startProtecting(player: any) {
  stopCurrentActivity();
  if (!bot.pathfinder || !player?.entity) {
    safeChat('Gomen! Pathfinder chưa sẵn sàng để bảo vệ bạn! (´;ω;)');
    return;
  }
  console.log(`🛡️ Bắt đầu bảo vệ ${player.username}`);
  safeChat(`Hai ${player.username}-chan! Tôi sẽ bảo vệ bạn khỏi tất cả quái vật! (ง •̀_•́)ง`);
  currentMode = 'protecting';
  startAutoEquipment();
  
  const protectDistance = 2.0;
  const goal = new goals.GoalFollow(player.entity, protectDistance);
  bot.pathfinder.setGoal(goal, true);

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
        if (!bot.pathfinder.goal) {
          bot.pathfinder.setGoal(goal, true);
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
    }));

    if (nearbyEntities.length > 0) {
      const threat = nearbyEntities[0] as any;
      const threatDistance = (threat as any).position.distanceTo(bot.entity.position);

      if (threatDistance > 10) {
        safeChat('Có quái vật! Tôi đang đến bảo vệ bạn! (ง •̀_•́)ง');
        bot.chat(`/tp ${targetPlayer.username}`);
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
          bot.pathfinder.setGoal(new goals.GoalFollow(targetPlayer.entity, 2.0), true);
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
        bot.pathfinder.setGoal(new goals.GoalNear(creeper.position.x, creeper.position.y, creeper.position.z, 2), true);
      } else if (distance <= 4 && distance > 2) {
        bot.attack(creeper);
      } else {
        bot.pathfinder.setGoal(new goals.GoalNear(creeper.position.x, creeper.position.y, creeper.position.z, 6), true);
      }
    }, 500);
  } catch (error) {
    console.log('🔧 Lỗi tấn công creeper...');
    creeperAvoidanceMode = false;
  }
}

function startAutoFarm(mobType: string) {
  stopCurrentActivity();
  currentMode = 'autofarming';
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
      bot.pathfinder.setGoal(new goals.GoalFollow(mob, 2), true);
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

// FIX: Cải thiện hệ thống chat với hàng đợi
function safeChat(message: string) {
  chatQueue.push(message);
  processChatQueue();
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
    
    // Thêm log để kiểm tra
    console.log(`✅ Đang xử lý lệnh từ ${username}: "${lowerMessage}"`);

    if (lowerMessage.includes('hỏi nè')) {
      console.log('➡️ Lệnh: Hỏi');
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
      console.log('➡️ Lệnh: Hướng dẫn');
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
      console.log('➡️ Lệnh: Tìm rương');
      stopCurrentActivity();
      currentMode = 'chest_hunting';
      currentCommand = 'tìm rương';
      lastActivityTime = Date.now();
      safeChat(`Hai ${username}-chan! Tôi sẽ tìm rương xung quanh trong bán kính 32 block! 📦✨`);
      startChestHunting();
      return;
    }

    if (lowerMessage.includes('auto khám phá')) {
      console.log('➡️ Lệnh: Auto khám phá');
      stopCurrentActivity();
      currentMode = 'exploring';
      currentCommand = 'auto khám phá';
      lastActivityTime = Date.now();
      safeChat(`Kyaa~! ${username}-chan! Tôi sẽ khám phá thế giới thông minh! 🗺️✨ Tìm rương, đánh quái, tránh lá cây!`);
      startSmartExplore();
      return;
    }
    
    if (lowerMessage.includes('auto xây')) {
      console.log('➡️ Lệnh: Auto xây');
      const buildMatch = lowerMessage.match(/auto xây (.+)/i);
      if (buildMatch) {
        const project = buildMatch[1];
        startAutoBuilding(project, username);
      } else {
        safeChat('Gomen! Anh muốn xây gì ạ? Hãy nói "auto xây [tên công trình]" nhé! 💕');
      }
      return;
    }
    
    if (lowerMessage.includes('auto câu')) {
      console.log('➡️ Lệnh: Auto câu');
      stopCurrentActivity();
      currentMode = 'fishing';
      currentCommand = 'auto câu';
      lastActivityTime = Date.now();
      startAutoFishing(username);
      return;
    }

    if (lowerMessage.includes('auto farm')) {
      console.log('➡️ Lệnh: Auto farm');
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
      console.log('➡️ Lệnh: Theo dõi');
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
      console.log('➡️ Lệnh: Bảo vệ');
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
      console.log('➡️ Lệnh: Auto mine');
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
      console.log('➡️ Lệnh: Hỏi đồ');
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
      console.log('➡️ Lệnh: Phản hồi hỏi đồ');
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
      console.log('➡️ Lệnh: Dừng');
      stopCurrentActivity();
      lastActivityTime = Date.now();
      safeChat(`Hai ${username}-chan! Tôi đã dừng tất cả hoạt động! (◕‿◕)`);
      return;
    }

    if (lowerMessage.includes('túi đồ') || lowerMessage.includes('inventory') || lowerMessage.includes('đồ của em')) {
      console.log('➡️ Lệnh: Túi đồ');
      showInventoryToPlayer(username);
      return;
    }

    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('chào')) {
      console.log('➡️ Lệnh: Chào hỏi');
      safeChat(`Chào ${username}-chan! (◕‿◕)♡ Rất vui được gặp bạn! UwU`);
    } else if (lowerMessage.includes('dance') || lowerMessage.includes('nhảy')) {
      console.log('➡️ Lệnh: Nhảy');
      if (currentMode === 'idle') {
        safeChat('Kyaa~! Tôi sẽ nhảy cho bạn xem! ♪(´▽｀)♪');
        performDance();
      }
    } else if (lowerMessage.includes('cute') || lowerMessage.includes('dễ thương')) {
      console.log('➡️ Lệnh: Cute');
      safeChat('Arigatou gozaimasu! (///▽///) Bạn cũng rất dễ thương đấy! 💕');
    } else if (message.length > 3 && !lowerMessage.includes('stop') && !lowerMessage.includes('dừng')) {
      console.log('➡️ Lệnh: Gemini chat (fallback)');
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
    botScreenData.status = botScreenData.status;
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

function handleDisconnection(reason: string) {
  isConnected = false;
  stopCurrentActivity();
  console.log(`💔 Bot đã bị ngắt kết nối: ${reason || 'Unknown reason'}`);
  attemptReconnect();
}

function handleBotError(err: Error) {
  console.log(`🔧 Bot error: ${err.message}`);
  const ignoredErrors = [
    'unknown chat format code', 'chat format', 'ENOTFOUND', 'ECONNREFUSED',
    'ETIMEDOUT', 'socket hang up', 'ECONNRESET', 'connection throttled',
    'throttled', 'failed to connect'
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

function startHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  healthCheckInterval = setInterval(() => {
    if (!bot || !isConnected) {
      clearInterval(healthCheckInterval!);
      return;
    }
    if (bot.health <= 6 || bot.food <= 6) {
      attemptSelfFeedingAndHealing();
    }
  }, HEALTH_CHECK_DELAY);
}

function startIdleMonitoring() {
  if (selfDefenseInterval) {
    clearInterval(selfDefenseInterval);
  }
  selfDefenseInterval = setInterval(() => {
    if (!bot || !isConnected) {
      clearInterval(selfDefenseInterval!);
      return;
    }
    const timeSinceLastActivity = Date.now() - lastActivityTime;
    if (timeSinceLastActivity > IDLE_TIMEOUT && currentMode === 'idle') {
      console.log('🛡️ Bot idle quá lâu, chuyển sang chế độ tự vệ...');
      startSelfDefense();
    }
    if (currentMode === 'idle') {
      botScreenData.status = 'Đang nghỉ ngơi và quan sát...';
      updateBotScreen();
    }
  }, 30000);
}

function startSelfDefense() {
  if (currentMode !== 'idle') return;
  currentMode = 'self_defense';
  safeChat('Tôi đã nghỉ quá lâu rồi! Giờ sẽ tự vệ và tìm kiếm kẻ thù! (ง •̀_•́)ง');
  const selfDefenseInterval = setInterval(() => {
    if (!bot || !isConnected || currentMode !== 'self_defense') {
      clearInterval(selfDefenseInterval);
      return;
    }
    try {
      const nearbyMobs = Object.values(bot.entities).filter((entity: any) => 
        entity.kind === 'Hostile mobs' && 
        entity.position.distanceTo(bot.entity.position) < 16
      );
      if (nearbyMobs.length > 0) {
        const target = nearbyMobs[0];
        bot.attack(target);
        botScreenData.status = `Đang tấn công ${target.displayName || 'mob'}!`;
      } else {
        const moves = ['forward', 'back', 'left', 'right'] as const;
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        bot.setControlState(randomMove, true);
        setTimeout(() => {
          if (bot && currentMode === 'self_defense') {
            bot.setControlState(randomMove, false);
          }
        }, 1000);
        botScreenData.status = 'Đang tuần tra tìm kẻ thù...';
      }
      updateBotScreen();
      lastActivityTime = Date.now();
    } catch (error) {
      console.log('🔧 Lỗi self defense...');
    }
  }, 3000);
  setTimeout(() => {
    if (currentMode === 'self_defense') {
      currentMode = 'idle';
      safeChat('Đã tự vệ xong! Quay lại nghỉ ngơi! (◕‿◕)');
      clearInterval(selfDefenseInterval);
      startRandomMovement();
    }
  }, 300000);
}

async function attemptSelfFeedingAndHealing() {
  const isHungry = bot.food <= 6;
  const isLowHealth = bot.health <= 6;
  const healthPotion = bot.inventory.findInventoryItem('potion', 8261);
  if (isHungry) {
    const foodItems = checkInventoryForItem('food').items;
    if (foodItems.length > 0) {
      await bot.equip(foodItems[0], 'hand');
      await bot.consume();
      safeChat(`Đang ăn đồ ăn ngon! Om nom nom! (◕‿◕)`);
      return;
    }
  }
  if (isLowHealth && healthPotion) {
    await bot.equip(healthPotion, 'hand');
    await bot.consume();
    safeChat('Đang uống thuốc hồi máu! Tôi sẽ khỏe lại ngay! 💖');
    return;
  }
}

function startSmartExplore() {
  stopCurrentActivity();
  safeChat('Bắt đầu khám phá thông minh! Tránh lá cây, dùng tools hợp lý! 🗺️✨');
  currentMode = 'exploring';
  exploringInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'exploring') {
      clearInterval(exploringInterval!);
      return;
    }
    try {
      equipBestGear();
      const targets = findSmartExplorationTargets();
      
      if (targets.chests.length > 0) {
        lootNearestChest(targets.chests);
      } else if (targets.drops.length > 0 && !isInventoryFull) {
        collectNearestDrop(targets.drops);
      } else if (targets.mobs.length > 0) {
        attackNearestMob(targets.mobs);
      } else {
        exploreRandomDirection();
      }
      updateBotScreen();
    } catch (error) {
      console.log('🔧 Lỗi smart explore...');
    }
  }, 3000);
}

function findSmartExplorationTargets() {
  const targets = { chests: [] as any[], drops: [] as any[], mobs: [] as any[] };
  try {
    const position = bot.entity.position;
    Object.values(bot.entities).forEach((entity: any) => {
      if (!entity || !entity.position) return;
      const distance = position.distanceTo(entity.position);
      if (distance > 32) return;
      if (entity.objectType === 'Item') {
        targets.drops.push({
          entity, distance, item: entity.displayName || 'Unknown Item'
        });
      } else if (entity.type === 'mob' || entity.type === 'hostile') {
        targets.mobs.push({
          entity, distance, type: entity.displayName || entity.name || 'Unknown Mob'
        });
      }
    });
    for (let x = -32; x <= 32; x += 4) {
      for (let z = -32; z <= 32; z += 4) {
        for (let y = position.y - 15; y <= position.y + 5; y++) {
          const checkPos = position.offset(x, y, z);
          const block = bot.blockAt(checkPos);
          if (block && (block.name.includes('chest') || block.name.includes('barrel'))) {
            const chestKey = `${checkPos.x},${checkPos.y},${checkPos.z}`;
            if (!exploredChests.has(chestKey)) {
              const distance = position.distanceTo(checkPos);
              targets.chests.push({
                position: checkPos, distance, type: block.name, block
              });
            }
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

function lootNearestChest(chests: any[]) {
  if (!chests.length) return;
  const nearestChest = chests[0];
  safeChat(`Kyaa! Tìm thấy ${nearestChest.type} dưới lòng đất! Có gì hay ho không nhỉ? 📦✨`);
  try {
    bot.clearControlStates();
    if (bot.pathfinder && goals) {
      const goal = new goals.GoalBlock(nearestChest.position.x, nearestChest.position.y, nearestChest.position.z);
      bot.pathfinder.setGoal(goal, true);
      bot.pathfinder.on('goal_reached', async () => {
        try {
          const chest = bot.blockAt(nearestChest.position);
          if (!chest) {
            exploredChests.add(nearestChest.key);
            return;
          }
          const window = await bot.openChest(chest);
          for (const item of window.slots) {
            if (item && bot.inventory.emptySlotCount() > 2) {
              await window.withdraw(item.type, null, item.count);
            }
          }
          window.close();
          exploredChests.add(nearestChest.key);
          safeChat('Loot xong rương rồi! (◕‿◕)♡');
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

function startAutoMining(oreType: string) {
  stopCurrentActivity();
  const pickaxe = equipBestPickaxe();
  if (!pickaxe) {
    safeChat('Em không có cuốc để đào! (´;ω;) Cần anh cho em cuốc!');
    return;
  }
  safeChat(`Hai ${bot.username}-chan! Tôi sẽ đào ${oreType} ore với cuốc xịn nhất! ⛏️✨`);
  currentMode = 'mining';
  miningInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'mining') {
      clearInterval(miningInterval!);
      return;
    }
    try {
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

function exploreForOres(oreType: string) {
  try {
    const position = bot.entity.position;
    const optimalYLevels = {
      'diamond': -54, 'iron': 15, 'gold': -32, 'copper': 48,
      'emerald': -16, 'coal': 96, 'netherite': 15
    };
    const targetY = optimalYLevels[oreType] || -54;

    const nearbyOres = findNearbyOres(oreType, 3);
    if (nearbyOres.length > 0) {
        mineNearestOre(nearbyOres[0]);
        return;
    }

    if (Math.abs(position.y - targetY) > 3) {
      safeChat(`Đang đào bậc thang để xuống Y=${targetY} tìm ${oreType}! ⛏️`);
      mineStaircase(targetY);
    } else {
      safeChat(`Đã tới độ sâu tối ưu! Bắt đầu đào ngang tìm ${oreType}! ⛏️`);
      mineHorizontally();
    }
  } catch (error) {
    console.log(`🔧 Lỗi explore for ores: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function mineStaircase(targetY: number) {
  const position = bot.entity.position;
  const yDirection = targetY > position.y ? 1 : -1;
  const offset = yDirection > 0 ? bot.vec3(0, 1, 0) : bot.vec3(0, -1, 0);
  const goal = new goals.GoalY(targetY);
  bot.pathfinder.setGoal(goal, true);
  bot.pathfinder.on('goal_reached', () => {
    bot.pathfinder.setGoal(null);
  });
}

function mineHorizontally() {
  const directions = ['forward', 'left', 'right', 'back'] as const;
  const randomDir = directions[Math.floor(Math.random() * directions.length)];
  const position = bot.entity.position;
  const directionOffsets = {
    forward: bot.vec3(0, 0, 1), back: bot.vec3(0, 0, -1),
    left: bot.vec3(-1, 0, 0), right: bot.vec3(1, 0, 0)
  };
  const offset = directionOffsets[randomDir];
  const targetBlock = bot.blockAt(position.offset(offset.x, 0, offset.z));
  if (targetBlock && targetBlock.name !== 'air') {
    bot.dig(targetBlock);
    setTimeout(() => {
      bot.setControlState(randomDir, true);
      setTimeout(() => bot.setControlState(randomDir, false), 1000);
    }, 500);
  } else {
     bot.setControlState(randomDir, true);
      setTimeout(() => bot.setControlState(randomDir, false), 1000);
  }
}

async function startAutoFishing(username: string) {
  stopCurrentActivity();
  const rod = bot.inventory.findInventoryItem('fishing_rod');
  if (!rod) {
    safeChat('Gomen! Em không có cần câu! (´;ω;) Ai cho em cần câu được không ạ?');
    return;
  }
  safeChat('Có cần câu rồi! Em sẽ đi tìm chỗ có nước để câu cá! 🎣✨');
  currentMode = 'fishing';
  let waterBlock = null;
  for(let i = 0; i < 20; i++) {
    waterBlock = bot.findBlock({ matching: block => block.name === 'water' });
    if(waterBlock) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!waterBlock) {
    safeChat('Gomen! Không tìm thấy chỗ nào có nước! Em sẽ khám phá để tìm! 🗺️');
    exploreRandomDirection();
    return;
  }
  const goal = new goals.GoalNear(waterBlock.position.x, waterBlock.position.y, waterBlock.position.z, 3);
  bot.pathfinder.setGoal(goal, true);
  bot.pathfinder.on('goal_reached', async () => {
    safeChat('Tìm thấy chỗ câu cá rồi! Bắt đầu câu đây! 🎣');
    await bot.equip(rod, 'hand');
    const fishingInterval = setInterval(() => {
      if(currentMode !== 'fishing' || !isConnected || !bot) {
        clearInterval(fishingInterval);
        return;
      }
      const threats = findNearbyThreats();
      if(threats.length > 0) {
        safeChat('Có quái vật! Đang tự vệ! (ง •̀_•́)ง');
        stopCurrentActivity();
        currentMode = 'protecting';
        bot.attack(threats[0].entity);
      } else {
        bot.fish.castFish();
        bot.once('caught_fish', (item) => {
          safeChat(`Kyaa~! Em câu được một ${item.displayName}! Yay! ✨`);
        });
      }
    }, 10000);
  });
}

async function startAutoBuilding(project: string, username: string) {
  stopCurrentActivity();
  safeChat(`Để tôi dùng AI thiết kế ${project}! Chờ một chút nhé! 🧠✨`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  safeChat(`AI đã thiết kế xong! Bắt đầu xây ${project}! 🏗️`);
  const originalGamemode = bot.game.gameMode;
  bot.chat('/gamemode creative');
  if (bot.creative) {
    bot.creative.fly.setFlying(true);
  }
  const buildingPlan = await generateBuildingPlan(project, username);
  if (!buildingPlan) {
    safeChat(`Gomen ${username}-chan! AI không thể thiết kế ${project}! (´;ω;)`);
    return;
  }
  botScreenData.status = `Đang xây dựng ${project}...`;
  for (const blockData of buildingPlan.blocks) {
    const item = bot.inventory.findInventoryItem(blockData.type);
    if (!item) {
      safeChat(`Thiếu block ${blockData.type}! Không thể xây tiếp! (´;ω;)`);
      break;
    }
    await bot.equip(item, 'hand');
    for (const pos of blockData.positions) {
      await bot.creative.setBlock(bot.vec3(pos.x, pos.y, pos.z), blockData.type);
    }
  }
  safeChat(`Xây xong ${project} rồi! Đẹp không? (◕‿◕)♡`);
  bot.chat(`/gamemode ${originalGamemode}`);
  if (bot.creative) {
    bot.creative.fly.setFlying(false);
  }
}

async function generateBuildingPlan(project: string, username: string) {
  safeChat('🧠 Đang tư duy để tạo kế hoạch xây dựng...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  return {
    name: project,
    blocks: [
      { type: 'oak_planks', positions: [
        { x: bot.entity.position.x, y: bot.entity.position.y - 1, z: bot.entity.position.z },
        { x: bot.entity.position.x + 1, y: bot.entity.position.y - 1, z: bot.entity.position.z },
        { x: bot.entity.position.x, y: bot.entity.position.y, z: bot.entity.position.z }
      ] },
      { type: 'glass', positions: [
        { x: bot.entity.position.x, y: bot.entity.position.y + 1, z: bot.entity.position.z }
      ]}
    ]
  };
}

function equipBestGear() {
  try {
    if (!bot || !bot.inventory) return;
    const swords = bot.inventory.items().filter((item: any) => item.name.includes('sword'));
    const bestSword = swords.reduce((best: any, current: any) => {
      const swordPriority: any = { 'diamond_sword': 3, 'iron_sword': 2, 'stone_sword': 1, 'wooden_sword': 0 };
      const bestPriority = swordPriority[best?.name] || 0;
      const currentPriority = swordPriority[current?.name] || 0;
      return currentPriority > bestPriority ? current : best;
    }, null);
    if (bestSword && bot.heldItem?.name !== bestSword.name) {
      bot.equip(bestSword, 'hand');
    }
    const armorPieces = ['helmet', 'chestplate', 'leggings', 'boots'];
    const armorPriority: any = { 'diamond': 3, 'iron': 2, 'chainmail': 1, 'leather': 0 };
    armorPieces.forEach(piece => {
      const armorItems = bot.inventory.items().filter((item: any) => item.name.includes(piece));
      const bestArmor = armorItems.reduce((best: any, current: any) => {
        let bestPriority = 0;
        let currentPriority = 0;
        for (const material in armorPriority) {
          if (best?.name.includes(material)) { bestPriority = armorPriority[material]; }
          if (current?.name.includes(material)) { currentPriority = armorPriority[material]; }
        }
        return currentPriority > bestPriority ? current : best;
      }, null);
      if (bestArmor) {
        const equipSlot = piece === 'helmet' ? 'head' : piece === 'chestplate' ? 'torso' : piece === 'leggings' ? 'legs' : 'feet';
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

function checkInventoryForItem(itemName: string) {
  try {
    let totalCount = 0;
    let foundItems: any[] = [];
    const itemAliases = {
      'iron': ['iron_ingot', 'iron_ore', 'raw_iron'], 'gold': ['gold_ingot', 'gold_ore', 'raw_gold'],
      'diamond': ['diamond', 'diamond_ore'], 'coal': ['coal', 'coal_ore'],
      'stone': ['stone', 'cobblestone'], 'wood': ['oak_log', 'birch_log'],
      'food': ['bread', 'apple', 'cooked_beef', 'cooked_porkchop'],
      'tool': ['pickaxe', 'axe', 'shovel', 'sword', 'hoe']
    };
    const searchTerms = itemAliases[itemName] || [itemName];
    for (const item of bot.inventory.items()) {
      const itemFullName = (item.name || '').toLowerCase();
      const itemDisplayName = (item.displayName || '').toLowerCase();
      const matchesSearch = searchTerms.some(term => 
        itemFullName.includes(term) || itemDisplayName.includes(term) || itemFullName === term
      );
      if (matchesSearch) {
        totalCount += item.count;
        foundItems.push(item);
      }
    }
    return { count: totalCount, items: foundItems, hasItem: totalCount > 0 };
  } catch (error) {
    console.log('🔧 Lỗi check inventory:', error);
    return { count: 0, items: [], hasItem: false };
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
    }
    safeChat(`Đã ném ${amount} ${itemName} cho ${username}-chan rồi! Lụm nhanh nhé! 💕`);
  } catch (error) {
    console.log(`🔧 Lỗi give item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    safeChat(`Gomen ${username}-chan! Em không ném được đồ! (´;ω;)`);
  }
}

function showInventoryToPlayer(username: string) {
  try {
    const items = bot.inventory.items();
    if (items.length === 0) {
      safeChat(`${username}-chan! Em không có đồ gì cả! (´;ω;) Túi rỗng luôn!`);
      return;
    }
    const itemGroups = items.reduce((groups: Record<string, number>, item: any) => {
      const itemName = item.displayName || item.name;
      groups[itemName] = (groups[itemName] || 0) + item.count;
      return groups;
    }, {});
    const itemList = Object.entries(itemGroups)
      .slice(0, 5)
      .map(([name, count]) => `${name} x${count}`)
      .join(', ');
    const totalItems = items.reduce((sum: number, item: any) => sum + item.count, 0);
    const totalSlots = items.length;
    safeChat(`${username}-chan! Em có ${totalItems} đồ (${totalSlots} loại): ${itemList}${Object.keys(itemGroups).length > 5 ? '...' : ''}! Cần gì thì hỏi em nhé! 💕`);
  } catch (error) {
    console.log('🔧 Lỗi show inventory:', error);
    safeChat(`${username}-chan! Em không xem được túi đồ! (´;ω;)`);
  }
}

function findNearbyOres(oreType: string, radius: number = 10) {
  const position = bot.entity.position;
  const ores: any[] = [];
  const oreBlocks: Record<string, string[]> = {
    'iron': ['iron_ore', 'deepslate_iron_ore'], 'gold': ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
    'diamond': ['diamond_ore', 'deepslate_diamond_ore'], 'copper': ['copper_ore', 'deepslate_copper_ore'],
    'emerald': ['emerald_ore', 'deepslate_emerald_ore'], 'coal': ['coal_ore', 'deepslate_coal_ore'],
    'netherite': ['ancient_debris']
  };
  const targetBlocks = oreBlocks[oreType] || [];
  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const checkPos = position.offset(x, y, z);
        try {
          const block = bot.blockAt(checkPos);
          if (block && targetBlocks.includes(block.name)) {
            const distance = position.distanceTo(checkPos);
            ores.push({ position: checkPos, distance: distance, type: block.name });
          }
        } catch (blockError) { continue; }
      }
    }
  }
  ores.sort((a, b) => a.distance - b.distance);
  return ores;
}

function mineNearestOre(ore: any) {
  console.log(`⛏️ Đào ${ore.type} tại (${Math.floor(ore.position.x)}, ${Math.floor(ore.position.y)}, ${Math.floor(ore.position.z)})`);
  try {
    if (bot.pathfinder && goals) {
      const distance = bot.entity.position.distanceTo(ore.position);
      if (distance <= 3) {
        bot.pathfinder.setGoal(null);
        bot.dig(bot.blockAt(ore.position));
      } else {
        const goal = new goals.GoalBlock(ore.position.x, ore.position.y, ore.position.z);
        bot.pathfinder.setGoal(goal, true);
        bot.pathfinder.on('goal_reached', () => {
          bot.pathfinder.setGoal(null);
          bot.dig(bot.blockAt(ore.position));
        });
      }
    }
    botScreenData.status = `Đang đào ${ore.type}`;
  } catch (error) {
    console.log(`🔧 Lỗi mine ore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function returnToDroppedItems() {
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
    bot.pathfinder.setGoal(goal, true);
    setTimeout(() => {
      if (currentMode === 'item_recovery') {
        safeChat('Hết thời gian tìm đồ rớt! Có thể đã despawn rồi! (´;ω;)');
        stopCurrentActivity();
        droppedItemsLocation = null;
      }
    }, 30000);
  }
}

async function answerQuestion(question: string, username: string) {
  try { return `${username}-chan! Câu hỏi hay quá! Về "${question}", tôi nghĩ... hmm... Tôi cần học thêm để trả lời tốt hơn! (◕‿◕)♡`; } catch (error) { throw error; }
}
async function helpWithTask(task: string, username: string) {
  try { return `${username}-chan! Để làm "${task}", tôi suggest: Bước 1: Chuẩn bị nguyên liệu. Bước 2: Lên kế hoạch. Bước 3: Thực hiện từng bước nhỏ! Chúc bạn thành công! ✨`; } catch (error) { throw error; }
}
async function generateLoliResponse(message: string, username: string) {
  try {
    const responses = [
      `${username}-chan nói hay quá! (◕‿◕)♡`, `UwU ${username}-chan! Bạn làm tôi vui quá! 💕`,
      `Kyaa~! ${username}-chan thật dễ thương! ✨`, `Hihi! ${username}-chan luôn biết cách làm tôi cười! 🌸`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  } catch (error) { throw error; }
}

function exploreRandomDirection() {
  if (!bot || !bot.pathfinder) return;
  try {
    const randomX = bot.entity.position.x + (Math.random() - 0.5) * 20;
    const randomZ = bot.entity.position.z + (Math.random() - 0.5) * 20;
    const goal = new goals.GoalXZ(randomX, randomZ);
    bot.pathfinder.setGoal(goal, true);
    botScreenData.status = 'Đang khám phá ngẫu nhiên';
  } catch (error) {
    console.log('🔧 Lỗi explore random direction:', error);
  }
}

function startChestHunting() {
  safeChat('Bắt đầu săn chest! ✨ Tìm kho báu nào! 💎');
  currentMode = 'chest_hunting';
  botScreenData.status = 'Đang săn chest';
  updateBotScreen();
}

function collectNearestDrop() {
  if (!bot) return;
  try {
    const drops = Object.values(bot.entities).filter((entity: any) => 
      entity && entity.name === 'item' && entity.position &&
      entity.position.distanceTo(bot.entity.position) <= 10
    );
    if (drops.length > 0) {
      const nearest = drops.reduce((closest: any, current: any) => {
        const closestDist = closest.position.distanceTo(bot.entity.position);
        const currentDist = current.position.distanceTo(bot.entity.position);
        return currentDist < closestDist ? current : closest;
      }) as any;
      const goal = new goals.GoalBlock(nearest.position.x, nearest.position.y, nearest.position.z);
      bot.pathfinder.setGoal(goal, true);
      botScreenData.status = 'Đang thu thập vật phẩm rơi';
    }
  } catch (error) {
    console.log('🔧 Lỗi collect nearest drop:', error);
  }
}

function attackNearestMob() {
  if (!bot) return;
  try {
    const mobs = Object.values(bot.entities).filter((entity: any) => 
      entity && entity.type === 'mob' && entity.position &&
      entity.position.distanceTo(bot.entity.position) <= 10 &&
      ['zombie', 'skeleton', 'creeper', 'spider'].includes(entity.name?.toLowerCase() || '')
    );
    if (mobs.length > 0) {
      const nearest = mobs.reduce((closest: any, current: any) => {
        const closestDist = closest.position.distanceTo(bot.entity.position);
        const currentDist = current.position.distanceTo(bot.entity.position);
        return currentDist < closestDist ? current : closest;
      }) as any;
      bot.attack(nearest);
      botScreenData.status = `Đang tấn công ${nearest.name}`;
    }
  } catch (error) {
    console.log('🔧 Lỗi attack nearest mob:', error);
  }
}

function findNearbyThreats() {
  if (!bot) return [];
  return Object.values(bot.entities).filter((entity: any) => 
    entity && entity.type === 'mob' && entity.position &&
    entity.position.distanceTo(bot.entity.position) <= 15 &&
    ['zombie', 'skeleton', 'creeper', 'spider', 'enderman'].includes(entity.name?.toLowerCase() || '')
  );
}

