import * as mineflayer from 'mineflayer';
import { pathfinder, Movements } from 'mineflayer-pathfinder';
// @ts-ignore
import * as goals from 'mineflayer-pathfinder/lib/goals';
import { answerQuestion, helpWithTask, generateLoliResponse } from './gemini';

// Type declarations for global
declare global {
  var BOTLOLICUTE_PROCESS_LOCK: number | undefined;
}

// console.log('🤖 Khởi động Bot Lolicute...');

// CRITICAL: Process control để tránh duplicate login
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
const startDelay = Math.random() * 3000; // 0-3 giây
setTimeout(() => {
  // Final check trước khi start - có thể process khác đã lock
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

function cleanup() {
  if (global[PROCESS_LOCK_KEY] === processStartTime) {
    delete global[PROCESS_LOCK_KEY];
  }
  clearAllIntervals();
  if (bot) {
    try {
      bot.quit('Cleanup process');
    } catch (error) {
      console.log('⚠️ Error during bot cleanup, continuing...');
    }
  }
}

// Enhanced clearAllIntervals function
function clearAllIntervals() {
  console.log(`🛑 Dừng hoạt động hiện tại: ${currentMode} -> ${currentMode}`);
  
  if (movementInterval) {
    clearInterval(movementInterval);
    movementInterval = null;
  }
  if (followingInterval) {
    clearInterval(followingInterval);
    followingInterval = null;
  }
  if (protectingInterval) {
    clearInterval(protectingInterval);
    protectingInterval = null;
  }
  if (autoFarmInterval) {
    clearInterval(autoFarmInterval);
    autoFarmInterval = null;
  }
  if (equipmentCheckInterval) {
    clearInterval(equipmentCheckInterval);
    equipmentCheckInterval = null;
  }
  if (exploringInterval) {
    clearInterval(exploringInterval);
    exploringInterval = null;
  }
  if (selfDefenseInterval) {
    clearInterval(selfDefenseInterval);
    selfDefenseInterval = null;
  }
  if (miningInterval) {
    clearInterval(miningInterval);
    miningInterval = null;
  }
  
  console.log('✅ Đã dừng hoạt động ' + currentMode + ' thành công');
}

// Cấu hình bot với settings ổn định hơn
const BOT_CONFIG = {
  host: 'thuatzai123.aternos.me',
  port: 38893,
  username: 'botlolicute', // Tên cố định không có số đằng sau
  version: '1.19.4',
  skipValidation: true,
  checkTimeoutInterval: 60000,
  keepAlive: true,
  hideErrors: false,
  auth: 'offline' as 'offline'
};

// Biến trạng thái
let bot: any = null;
let isConnected = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 7; // Increased max attempts
let movementInterval: NodeJS.Timeout | null = null;

// Biến trạng thái cho tính năng mới
let lastHealthChatTime = 0;
const HEALTH_CHAT_DELAY = 20000; // 20 giây delay giữa các tin nhắn sức khỏe
let currentMode = 'idle'; // 'idle', 'following', 'protecting', 'autofarming', 'exploring', 'self_defense'
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
let exploredChests: Set<string> = new Set(); // Lưu tọa độ rương đã loot
let isInventoryFull = false;
let currentExploreTarget: any = null;
let explorationPath: any[] = [];
let lastActivityTime = Date.now(); // Track last activity for self-defense

// MINING FEATURES
let miningInterval: NodeJS.Timeout | null = null;
let miningTarget = '';
let isWaitingForResponse = false;
let pendingUser = '';
let pendingAction = '';

// Chat delay cho combat messages
let lastCombatChatTime = 0;

// SELF DEFENSE FEATURES  
const IDLE_TIMEOUT = 3 * 60 * 1000; // 3 minutes in milliseconds

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

// Chat queue and delay variables - IMPROVED: Better chat management  
const chatQueue: string[] = [];
let isChatting = false;
const CHAT_DELAY = 4000; // 4 seconds delay between chats để tránh spam
let lastChatTime = 0;

// Enhanced bot state management
let previousActivity = 'idle'; // Store previous activity to resume after health/food issues
let droppedItemsLocation: any = null; // Store location where items were dropped
let lastDeathLocation: any = null; // Store death location
let isLowHealth = false;
let isHungry = false;
let isReturningToDrops = false;

// Mining system improvements
let currentMiningDepth = 0;
let lastTorchPosition: any = null;
let torchPlacementDistance = 7;
let miningStaircase = true; // Mining in staircase pattern

// Exploration improvements
let avoidLeaves = true;
let useToolsForObstacles = true;

// Chest finding
let chestSearchRadius = 32;
let foundChests: any[] = [];

// Auto building with AI
let buildingMode = false;
let buildingPlan: any = null;
let originalGameMode = 'survival';

// Hàm khởi động bot chính
function startBot() {
  createBot();
}

// Hàm tạo bot an toàn với duplicate check
function createBot() {
  // Double-check process lock trước khi tạo bot
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

// Thiết lập tất cả các sự kiện bot
function setupBotEvents() {
  if (!bot) return;

  // Sự kiện spawn - bot đã tham gia server
  bot.on('spawn', () => {
    isConnected = true;
    reconnectAttempts = 0;
    console.log('💕 Bot Lolicute đã tham gia server! Konnichiwa minna-san! UwU');

    // Load pathfinder plugin
    bot.loadPlugin(pathfinder);
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);

    setTimeout(() => {
      safeChat('Chào mừng đến với bot loli! 💕 Tôi là bot dễ thương của bạn! (◕‿◕)♡');
    }, 2000); // Initial welcome message

    // Initialize bot screen data
    updateBotScreen();
    botScreenData.status = 'Đã kết nối thành công!';
    
    // Reset activity timer
    lastActivityTime = Date.now();
    
    // Start background systems
    startRandomMovement();
    startIdleMonitoring(); // Start self-defense monitoring system
  });

  // Sự kiện chat - xử lý tin nhắn chat
  bot.on('chat', (username: string, message: string) => {
    handleChatMessage(username, message);
  });

  // Sự kiện message - xử lý raw messages
  bot.on('message', (jsonMsg: any) => {
    handleRawMessage(jsonMsg);
  });

  // Sự kiện player joined
  bot.on('playerJoined', (player: any) => {
    console.log(`👋 ${player.username} đã tham gia server`);
    setTimeout(() => {
      safeChat(`Chào mừng ${player.username}-chan! (◕‿◕)♡ Hy vọng bạn sẽ vui vẻ ở đây! UwU`);
    }, 3000);
  });

  // Sự kiện player left
  bot.on('playerLeft', (player: any) => {
    console.log(`👋 ${player.username} đã rời server`);
    safeChat(`Sayonara ${player.username}-chan! (´;ω;) Hẹn gặp lại! 💔`);

    // Nếu player đang theo dõi rời đi, dừng theo dõi
    if (targetPlayer && targetPlayer.username === player.username) {
      stopCurrentActivity();
      safeChat('Người mà tôi đang theo dõi đã rời đi! (´;ω;) Tôi sẽ nghỉ ngơi...');
    }
  });

  // Enhanced health management with survival features
  bot.on('health', () => {
    try {
      const now = Date.now();
      
      // Low health management (below 3 hearts = 6 HP)
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
      
      // Regular health chat with delay
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

  // Food management
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

  // Death handling with item recovery
  bot.on('death', () => {
    try {
      lastDeathLocation = { ...bot.entity.position };
      droppedItemsLocation = { ...bot.entity.position };
      safeChat('Nooo! Tôi đã chết! (;´∀`) Sẽ quay lại lụm đồ trong 5 giây!');
      
      setTimeout(() => {
        if (droppedItemsLocation && bot && isConnected) {
          safeChat('Tôi sẽ quay lại lụm đồ rớt! Wait for me!');
          isReturningToDrops = true;
          returnToDroppedItems();
        }
      }, 5000);
    } catch (error) {
      console.log('🔧 Lỗi xử lý death event...');
    }
  });

  // Sự kiện entityHurt - phát hiện mob gần player khi đang bảo vệ
  bot.on('entityHurt', (entity: any) => {
    if (currentMode === 'protecting' && targetPlayer) {
      checkForThreats();
    }
  });

  // Sự kiện end - bot bị ngắt kết nối
  bot.on('end', (reason: any) => {
    handleDisconnection(reason);
  });

  // Sự kiện error - xử lý lỗi
  bot.on('error', (err: any) => {
    handleBotError(err);
  });

  // Sự kiện kicked với xử lý duplicate login và throttling
  bot.on('kicked', (reason: any) => {
    isConnected = false;
    const reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
    console.log(`⚠️ Bot bị kick: ${reasonStr}`);

    // CRITICAL: Handle duplicate login by exiting process immediately
    if (reasonStr.includes('duplicate_login')) {
      console.log('🚫 DUPLICATE LOGIN DETECTED - Thoát ngay để tránh conflict...');
      // Delete process lock để cho process khác tiếp tục
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

  // Sự kiện login
  bot.on('login', () => {
    console.log('🔐 Đang đăng nhập vào server...');
  });
}

// Enhanced safe chat with delay management
function safeChat(message: string) {
  try {
    if (!bot || !isConnected || !message || message.length === 0) return;
    
    const now = Date.now();
    if (now - lastChatTime < CHAT_DELAY) {
      // Queue the message if still in delay period
      chatQueue.push(message);
      return;
    }
    
    lastChatTime = now;
    bot.chat(message);
    console.log(`🤖 Bot: ${message}`);
    
    // Process queue after delay
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

// Xử lý tin nhắn chat an toàn
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

// Xử lý raw message an toàn với better parsing
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
    // Hoàn toàn bỏ qua lỗi raw message
  }
}

// Xử lý phản hồi người dùng với tính năng mới
function processUserMessage(username: string, message: string) {
  try {
    const lowerMessage = message.toLowerCase();

    // Xử lý câu hỏi với Gemini AI - có từ 'hỏi nè'
    if (lowerMessage.includes('hỏi nè')) {
      const questionMatch = message.match(/hỏi nè\s+(.+)/i);
      if (questionMatch) {
        const question = questionMatch[1];
        safeChat(`Để tớ nghĩ một chút nhé ${username}-chan... 🤔💭`);

        // Gọi Gemini AI để trả lời
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

    // Xử lý yêu cầu giúp đỡ với Gemini AI - có từ 'nghe tớ nè'
    if (lowerMessage.includes('nghe tớ nè')) {
      const taskMatch = message.match(/nghe tớ nè\s+(.+)/i);
      if (taskMatch) {
        const task = taskMatch[1];
        safeChat(`Hai ${username}-chan! Để tớ nghĩ cách giúp bạn nhé... ✨🤗`);

        // Gọi Gemini AI để hướng dẫn
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

    // Tìm rương - có từ 'tìm rương'
    if (lowerMessage.includes('tìm rương')) {
      stopCurrentActivity();
      currentMode = 'chest_hunting';
      currentCommand = 'tìm rương';
      lastActivityTime = Date.now();
      safeChat(`Hai ${username}-chan! Tôi sẽ tìm rương xung quanh trong bán kính 32 block! 📦✨`);
      startChestHunting();
      return;
    }

    // Auto xây dựng với AI
    if (lowerMessage.includes('auto xây')) {
      const buildMatch = lowerMessage.match(/auto xây (.+)/i);
      if (buildMatch) {
        const buildingProject = buildMatch[1];
        stopCurrentActivity();
        currentMode = 'building';
        currentCommand = `auto xây ${buildingProject}`;
        lastActivityTime = Date.now();
        safeChat(`Hai ${username}-chan! Tôi sẽ dùng AI để thiết kế và xây ${buildingProject}! 🏗️✨`);
        startAutoBuilding(buildingProject, username);
      } else {
        safeChat(`${username}-chan! Hãy nói rõ muốn xây gì! VD: "auto xây nhà gỗ"`);
      }
      return;
    }

    // Lệnh auto khám phá - có từ 'auto khám phá'
    if (lowerMessage.includes('auto khám phá')) {
      stopCurrentActivity(); // Dừng lệnh hiện tại
      currentMode = 'exploring';
      currentCommand = 'auto khám phá';
      lastActivityTime = Date.now(); // Reset activity timer
      safeChat(`Kyaa~! ${username}-chan! Tôi sẽ khám phá thế giới thông minh! 🗺️✨ Tìm rương, đánh quái, tránh lá cây!`);
      startSmartExplore();
      return;
    }

    // Lệnh auto farm - có từ 'auto farm'
    if (lowerMessage.includes('auto farm')) {
      stopCurrentActivity(); // Dừng lệnh hiện tại
      const mobMatch = lowerMessage.match(/auto farm (\w+)/);
      if (mobMatch) {
        const mobType = mobMatch[1];
        currentMode = 'autofarming';
        autoFarmTarget = mobType;
        currentCommand = 'auto farm';
        lastActivityTime = Date.now(); // Reset activity timer
        safeChat(`Hai ${username}-chan! Tôi sẽ tự động farm ${mobType}! Với đồ xịn nhất! (ง •̀_•́)ง ✨`);
        startAutoFarm(mobType);
      } else {
        safeChat(`Gomen ${username}-chan! Hãy nói rõ loài sinh vật cần farm! VD: "auto farm spider"`);
      }
      return;
    }

    // Lệnh theo dõi - có từ 'theo'
    if (lowerMessage.includes('theo')) {
      stopCurrentActivity(); // Dừng lệnh hiện tại
      const player = bot?.players?.[username];
      if (player && player.entity) {
        currentMode = 'following';
        targetPlayer = player;
        currentCommand = 'theo';
        lastActivityTime = Date.now(); // Reset activity timer
        safeChat(`Hai ${username}-chan! Tôi sẽ theo bạn đi khắp nơi! ε=ε=ε=┌(˘▾˘)┘`);
        startFollowing(player);
      } else {
        safeChat(`Gomen ${username}-chan! Tôi không thể tìm thấy bạn! (´;ω;)`);
      }
      return;
    }

    // Lệnh bảo vệ - có từ 'bảo vệ'
    if (lowerMessage.includes('bảo vệ')) {
      stopCurrentActivity(); // Dừng lệnh hiện tại
      const player = bot?.players?.[username];
      if (player && player.entity) {
        currentMode = 'protecting';
        targetPlayer = player;
        currentCommand = 'bảo vệ';
        lastActivityTime = Date.now(); // Reset activity timer
        safeChat(`Hai ${username}-chan! Tôi sẽ bảo vệ bạn khỏi tất cả quái vật! (ง •̀_•́)ง`);
        startProtecting(player);
      } else {
        safeChat(`Gomen ${username}-chan! Tôi không thể tìm thấy bạn để bảo vệ! (´;ω;)`);
      }
      return;
    }

    // Lệnh auto mine - có từ 'auto mine'
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
          
          // Check dimension for netherite
          if (oreType === 'netherite') {
            const dimension = bot.game.dimension;
            if (dimension !== 'the_nether') {
              safeChat(`Gomen ${username}-chan! Netherite chỉ có ở Nether! Tôi đang ở ${dimension}! (´;ω;)`);
              return;
            }
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

    // Hỏi đồ - nhiều pattern khác nhau
    const itemPatterns = [
      /em có (\w+) không/,           // "em có iron không?"
      /có (\w+) không/,              // "có iron không?"
      /bot có (\w+) không/,          // "bot có iron không?"
      /(\w+) có không/,              // "iron có không?"
      /cho (\w+)/,                   // "cho iron"
      /give (\w+)/                   // "give iron"
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
        
        // Auto timeout sau 30 giây
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

    // Xử lý phản hồi khi đang chờ
    if (isWaitingForResponse && username === pendingUser) {
      if (lowerMessage.includes('cần') || lowerMessage.includes('cho') || lowerMessage.includes('có') || lowerMessage.includes('yes') || lowerMessage.includes('ok')) {
        // Lấy số lượng nếu có
        const quantityMatch = lowerMessage.match(/(\d+)/);
        const requestedAmount = quantityMatch ? parseInt(quantityMatch[1]) : null;
        
        const actionParts = pendingAction.split('_');
        if (actionParts[0] === 'give') {
          const itemName = actionParts[1];
          const availableAmount = parseInt(actionParts[2]);
          const giveAmount = requestedAmount && requestedAmount <= availableAmount ? requestedAmount : Math.min(10, availableAmount); // Mặc định cho 10 hoặc tất cả nếu ít hơn
          
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

    // Lệnh dừng
    if (lowerMessage.includes('stop') || lowerMessage.includes('dừng')) {
      stopCurrentActivity();
      lastActivityTime = Date.now(); // Reset activity timer
      safeChat(`Hai ${username}-chan! Tôi đã dừng tất cả hoạt động! (◕‿◕)`);
      return;
    }

    // Lệnh xem túi đồ
    if (lowerMessage.includes('túi đồ') || lowerMessage.includes('inventory') || lowerMessage.includes('đồ của em')) {
      showInventoryToPlayer(username);
      return;
    }

    // Phản hồi chào hỏi
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('chào')) {
      safeChat(`Chào ${username}-chan! (◕‿◕)♡ Rất vui được gặp bạn! UwU`);
    }

    // Phản hồi nhảy múa
    else if (lowerMessage.includes('dance') || lowerMessage.includes('nhảy')) {
      if (currentMode === 'idle') {
        safeChat('Kyaa~! Tôi sẽ nhảy cho bạn xem! ♪(´▽｀)♪');
        performDance();
      }
    }

    // Phản hồi cute
    else if (lowerMessage.includes('cute') || lowerMessage.includes('dễ thương')) {
      safeChat('Arigatou gozaimasu! (///▽///) Bạn cũng rất dễ thương đấy! 💕');
    }

    // Sử dụng Gemini AI cho các chat thông thường khác
    else if (message.length > 3 && !lowerMessage.includes('stop') && !lowerMessage.includes('dừng')) {
      // Chỉ dùng AI cho tin nhắn dài hơn 3 ký tự và không phải lệnh
      generateLoliResponse(message, username).then(response => {
        safeChat(response);
      }).catch(error => {
        console.log('🔧 Lỗi Gemini chat:', error);
        // Fallback response nếu AI lỗi
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

// Hàm dừng tất cả hoạt động hiện tại - IMPROVED
function stopCurrentActivity() {
  console.log(`🛑 Dừng hoạt động hiện tại: ${currentMode} -> idle`);
  
  const oldMode = currentMode;
  currentMode = 'idle';
  targetPlayer = null;
  currentCommand = '';
  autoFarmTarget = '';
  creeperAvoidanceMode = false;

  // Clear tất cả intervals ngay lập tức
  const intervals = [followingInterval, protectingInterval, movementInterval, autoFarmInterval, equipmentCheckInterval];
  intervals.forEach(interval => {
    if (interval) {
      clearInterval(interval);
    }
  });

  followingInterval = null;
  protectingInterval = null;
  movementInterval = null;
  autoFarmInterval = null;
  equipmentCheckInterval = null;

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

  // Update bot screen
  updateBotScreen();
  
  console.log(`✅ Đã dừng hoạt động ${oldMode} thành công`);
}

// Bắt đầu theo dõi player với pathfinding nâng cao - IMPROVED: Khoảng cách chính xác 1 block
function startFollowing(player: any) {
  if (followingInterval) {
    clearInterval(followingInterval);
  }

  console.log(`🏃 Bắt đầu theo dõi ${player.username}`);

  followingInterval = setInterval(() => {
    if (!isConnected || !bot || !player || !player.entity || currentMode !== 'following') {
      clearInterval(followingInterval!);
      return;
    }

    try {
      const botPos = bot.entity.position;
      const playerPos = player.entity.position;
      const distance = botPos.distanceTo(playerPos);

      // Update bot screen data
      botScreenData.targetPlayer = player.username;
      botScreenData.status = `Đang theo dõi ${player.username} (${distance.toFixed(1)}m)`;

      // Nếu cách quá xa (>20 blocks), dùng tp
      if (distance > 20) {
        bot.chat(`/tp ${player.username}`);
        safeChat('Kyaa~! Bạn đi quá xa rồi! Tôi sẽ teleport đến! ✨');
        botScreenData.status = `Teleport đến ${player.username}`;
        updateBotScreen();
        return;
      }

      // IMPROVED: Giữ khoảng cách chính xác 1 block (0.8-1.2)
      const targetDistance = 1.0;
      const tolerance = 0.2;

      if (distance < targetDistance - tolerance) {
        // Quá gần, lùi lại một chút
        moveAwayFromTarget(botPos, playerPos, 0.5);
        botScreenData.status = `Lùi lại để giữ khoảng cách với ${player.username}`;
      } else if (distance > targetDistance + tolerance) {
        // Quá xa, tiến lại gần
        moveTowardsPlayerPrecise(botPos, playerPos, targetDistance);
        botScreenData.status = `Tiến lại gần ${player.username}`;
      } else {
        // Khoảng cách lý tưởng, đứng yên và xoay theo player
        bot.lookAt(playerPos);
        ['forward', 'back', 'left', 'right', 'sprint'].forEach(control => {
          bot.setControlState(control, false);
        });
        botScreenData.status = `Đang theo dõi ${player.username} ở khoảng cách lý tưởng`;
      }

      // Check if player is in water - bot will swim
      const playerBlock = bot.blockAt(playerPos);
      if (playerBlock && (playerBlock.name === 'water' || playerBlock.name === 'lava')) {
        bot.setControlState('jump', true);
      }

      updateBotScreen();

    } catch (error) {
      console.log('🔧 Lỗi trong quá trình theo dõi...');
      botScreenData.status = 'Lỗi theo dõi player';
      updateBotScreen();
    }
  }, 300); // Check mỗi 0.3 giây để response nhanh và mượt hơn
}

// Bắt đầu bảo vệ player - IMPROVED: Hoạt động trơn tru, không đứng yên
function startProtecting(player: any) {
  if (protectingInterval) {
    clearInterval(protectingInterval);
  }

  console.log(`🛡️ Bắt đầu bảo vệ ${player.username}`);

  // Theo dõi player trước với khoảng cách bảo vệ (2 blocks)
  startFollowingForProtection(player);

  // Tự động trang bị đồ xịn nhất
  startAutoEquipment();

  protectingInterval = setInterval(() => {
    if (!isConnected || !bot || !player || !player.entity || currentMode !== 'protecting') {
      clearInterval(protectingInterval!);
      return;
    }

    try {
      // Check cho threats gần player liên tục
      const threats = checkForThreats();
      
      if (threats.length === 0) {
        // Không có threat, tiếp tục di chuyển quanh player để bảo vệ
        patrolAroundPlayer(player);
        botScreenData.status = `Đang tuần tra bảo vệ ${player.username}`;
      } else {
        botScreenData.status = `Đang chiến đấu với ${threats.length} quái vật!`;
      }

      updateBotScreen();

    } catch (error) {
      console.log('🔧 Lỗi trong chế độ bảo vệ...');
      botScreenData.status = 'Lỗi trong chế độ bảo vệ';
      updateBotScreen();
    }
  }, 500); // Check threats mỗi 0.5 giây để phản ứng nhanh hơn
}

// Check và tấn công threats - IMPROVED: Return threats list
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

    // Update bot screen with nearby mobs
    botScreenData.nearbyMobs = nearbyEntities.map((entity: any) => ({
      name: entity.name || entity.displayName || 'Unknown',
      distance: entity.position.distanceTo(bot.entity.position).toFixed(1)
    })) as any[];

    if (nearbyEntities.length > 0) {
      const threat = nearbyEntities[0] as any; // Tấn công threat đầu tiên
      const threatDistance = (threat as any).position.distanceTo(bot.entity.position);

      if (threatDistance > 10) {
        // Nếu quá xa, tp đến gần player trước
        bot.chat(`/tp ${targetPlayer.username}`);
        safeChat('Có quái vật! Tôi đang đến bảo vệ bạn! (ง •̀_•́)ง');
        botScreenData.status = `Teleport đến ${targetPlayer.username} để bảo vệ`;
      } else {
        // Kiểm tra creeper đặc biệt
        if ((threat as any).name && (threat as any).name.toLowerCase().includes('creeper')) {
          attackCreeper(threat);
        } else {
          // Tấn công mob bình thường
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

// Tấn công entity
function attackEntity(entity: any) {
  try {
    if (!bot || !entity) return;

    bot.attack(entity);

    const entityName = entity.name || entity.mobType || 'Unknown';
    safeChat(`Take this! Tôi sẽ bảo vệ chủ nhân! (ง •̀_•́)ง ${entityName}!`);

    // Sau khi tấn công, quay lại theo player
    setTimeout(() => {
      if ((currentMode === 'protecting' || currentMode === 'autofarming') && targetPlayer) {
        const playerDistance = bot.entity.position.distanceTo(targetPlayer?.entity?.position || bot.entity.position);
        if (playerDistance > 5) {
          safeChat('Quái vật đã được xử lý! Tôi quay lại nhiệm vụ! (◕‿◕)');
        }
      }
    }, 2000);

  } catch (error) {
    console.log('🔧 Lỗi tấn công entity...');
  }
}

// Tấn công creeper với chiến thuật đặc biệt
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

      // Hit và run strategy
      if (distance > 4) {
        // Di chuyển đến gần creeper
        moveTowardsEntity(creeper);
      } else if (distance <= 4 && distance > 2) {
        // Attack creeper
        bot.attack(creeper);
        safeChat('Hit! 💥');
      } else {
        // Quá gần, lùi lại
        moveAwayFromEntity(creeper);
        safeChat('Lùi lại! Cẩn thận phát nổ! (>_<)');
      }

    }, 500);

  } catch (error) {
    console.log('🔧 Lỗi tấn công creeper...');
    creeperAvoidanceMode = false;
  }
}

// Bắt đầu auto farm
function startAutoFarm(mobType: string) {
  if (autoFarmInterval) {
    clearInterval(autoFarmInterval);
  }

  // Tự động trang bị đồ xịn nhất
  startAutoEquipment();

  safeChat(`Bắt đầu auto farm ${mobType}! Tôi sẽ dùng đồ tốt nhất! ✨`);

  autoFarmInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'autofarming') {
      clearInterval(autoFarmInterval!);
      return;
    }

    try {
      // Tìm mobs cần farm
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
        // Không tìm thấy mob, di chuyển ngẫu nhiên để tìm
        randomMoveForFarming();
      }

    } catch (error) {
      console.log('🔧 Lỗi auto farm...');
    }
  }, 2000);
}

// Farm một mob cụ thể
function farmMob(mob: any) {
  try {
    const distance = bot.entity.position.distanceTo(mob.position);

    if (distance > 15) {
      // Quá xa, di chuyển đến
      moveTowardsEntity(mob);
    } else if (distance > 3) {
      // Trong tầm, tiến đến
      moveTowardsEntity(mob);
    } else {
      // Đủ gần, tấn công
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

// Di chuyển ngẫu nhiên để tìm mob
function randomMoveForFarming() {
  try {
    const directions = ['forward', 'back', 'left', 'right'] as const;
    const randomDir = directions[Math.floor(Math.random() * directions.length)];

    bot.setControlState(randomDir, true);
    setTimeout(() => {
      if (bot && isConnected) {
        bot.setControlState(randomDir, false);
      }
    }, 2000);

  } catch (error) {
    console.log('🔧 Lỗi di chuyển tìm mob...');
  }
}

// Di chuyển đến entity
function moveTowardsEntity(entity: any) {
  try {
    const botPos = bot.entity.position;
    const entityPos = entity.position;

    moveTowardsPlayer(botPos, entityPos);

  } catch (error) {
    console.log('🔧 Lỗi di chuyển đến entity...');
  }
}

// Di chuyển ra xa entity (dùng cho creeper)
function moveAwayFromEntity(entity: any) {
  try {
    const botPos = bot.entity.position;
    const entityPos = entity.position;

    const dx = botPos.x - entityPos.x;
    const dz = botPos.z - entityPos.z;

    // Reset controls
    ['forward', 'back', 'left', 'right', 'sprint'].forEach(control => {
      bot.setControlState(control, false);
    });

    // Di chuyển ra xa
    if (Math.abs(dx) > Math.abs(dz)) {
      if (dx > 0) {
        bot.setControlState('forward', true);
      } else {
        bot.setControlState('back', true);
      }
    } else {
      if (dz > 0) {
        bot.setControlState('left', true);
      } else {
        bot.setControlState('right', true);
      }
    }

    bot.setControlState('sprint', true);

  } catch (error) {
    console.log('🔧 Lỗi di chuyển ra xa entity...');
  }
}

// Tự động trang bị đồ tốt nhất
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
  }, 5000); // Check mỗi 5 giây
}

// Trang bị đồ tốt nhất
function equipBestGear() {
  try {
    if (!bot || !bot.inventory) return;

    // Tìm kiếm tốt nhất (ưu tiên: diamond > iron > stone)
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

    // Trang bị giáp tốt nhất
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

// Di chuyển thông minh đến player với pathfinding  
function moveTowardsPlayer(botPos: any, playerPos: any) {
  try {
    const dx = playerPos.x - botPos.x;
    const dy = playerPos.y - botPos.y;
    const dz = playerPos.z - botPos.z;

    // Reset tất cả controls trước
    ['forward', 'back', 'left', 'right', 'jump', 'sprint'].forEach(control => {
      bot.setControlState(control, false);
    });

    // Di chuyển theo trục X
    if (Math.abs(dx) > 1) {
      if (dx > 0) {
        bot.setControlState('forward', true);
      } else {
        bot.setControlState('back', true);
      }
    }

    // Di chuyển theo trục Z
    if (Math.abs(dz) > 1) {
      if (dz > 0) {
        bot.setControlState('left', true);
      } else {
        bot.setControlState('right', true);
      }
    }

    // Jump nếu cần leo lên hoặc có obstacle
    if (dy > 0.5) {
      bot.setControlState('jump', true);
    }

    // Sprint để di chuyển nhanh hơn
    bot.setControlState('sprint', true);

    // Check if need to swim
    const botBlock = bot.blockAt(botPos);
    if (botBlock && (botBlock.name === 'water' || botBlock.name === 'lava')) {
      bot.setControlState('jump', true); // Swim up
    }

  } catch (error) {
    console.log('🔧 Lỗi di chuyển...');
  }
}

// NEW: Di chuyển chính xác đến player với target distance
function moveTowardsPlayerPrecise(botPos: any, playerPos: any, targetDistance: number) {
  try {
    const dx = playerPos.x - botPos.x;
    const dy = playerPos.y - botPos.y;
    const dz = playerPos.z - botPos.z;
    const distance = Math.sqrt(dx*dx + dz*dz);

    // Tính toán vị trí mục tiêu (cách targetDistance)
    const ratio = (distance - targetDistance) / distance;
    const targetX = botPos.x + dx * ratio;
    const targetZ = botPos.z + dz * ratio;

    const finalDx = targetX - botPos.x;
    const finalDz = targetZ - botPos.z;

    // Reset controls
    ['forward', 'back', 'left', 'right', 'jump', 'sprint'].forEach(control => {
      bot.setControlState(control, false);
    });

    // Di chuyển chính xác
    if (Math.abs(finalDx) > 0.1) {
      if (finalDx > 0) {
        bot.setControlState('forward', true);
      } else {
        bot.setControlState('back', true);
      }
    }

    if (Math.abs(finalDz) > 0.1) {
      if (finalDz > 0) {
        bot.setControlState('left', true);
      } else {
        bot.setControlState('right', true);
      }
    }

    if (dy > 0.5) {
      bot.setControlState('jump', true);
    }

    // Luôn nhìn về phía player
    bot.lookAt(playerPos);

  } catch (error) {
    console.log('🔧 Lỗi di chuyển chính xác...');
  }
}

// NEW: Di chuyển ra xa target
function moveAwayFromTarget(botPos: any, targetPos: any, distance: number) {
  try {
    const dx = botPos.x - targetPos.x;
    const dz = botPos.z - targetPos.z;
    const currentDistance = Math.sqrt(dx*dx + dz*dz);

    if (currentDistance === 0) return;

    const ratio = distance / currentDistance;
    const targetX = targetPos.x + dx * ratio;
    const targetZ = targetPos.z + dz * ratio;

    const finalDx = targetX - botPos.x;
    const finalDz = targetZ - botPos.z;

    // Reset controls
    ['forward', 'back', 'left', 'right', 'sprint'].forEach(control => {
      bot.setControlState(control, false);
    });

    if (Math.abs(finalDx) > 0.1) {
      if (finalDx > 0) {
        bot.setControlState('forward', true);
      } else {
        bot.setControlState('back', true);
      }
    }

    if (Math.abs(finalDz) > 0.1) {
      if (finalDz > 0) {
        bot.setControlState('left', true);
      } else {
        bot.setControlState('right', true);
      }
    }

  } catch (error) {
    console.log('🔧 Lỗi di chuyển ra xa...');
  }
}

// NEW: Follow specifically for protection mode
function startFollowingForProtection(player: any) {
  // Use the same following logic but with protection distance (2 blocks)
  if (followingInterval) {
    clearInterval(followingInterval);
  }

  followingInterval = setInterval(() => {
    if (!isConnected || !bot || !player || !player.entity || currentMode !== 'protecting') {
      clearInterval(followingInterval!);
      return;
    }

    try {
      const botPos = bot.entity.position;
      const playerPos = player.entity.position;
      const distance = botPos.distanceTo(playerPos);

      botScreenData.targetPlayer = player.username;

      if (distance > 20) {
        bot.chat(`/tp ${player.username}`);
        return;
      }

      // Protection distance: 2 blocks
      const targetDistance = 2.0;
      const tolerance = 0.3;

      if (distance < targetDistance - tolerance) {
        moveAwayFromTarget(botPos, playerPos, 0.5);
      } else if (distance > targetDistance + tolerance) {
        moveTowardsPlayerPrecise(botPos, playerPos, targetDistance);
      } else {
        bot.lookAt(playerPos);
        ['forward', 'back', 'left', 'right'].forEach(control => {
          bot.setControlState(control, false);
        });
      }

    } catch (error) {
      console.log('🔧 Lỗi trong protection following...');
    }
  }, 400);
}

// NEW: Patrol around player for protection
function patrolAroundPlayer(player: any) {
  try {
    if (!bot || !player || !player.entity) return;

    const botPos = bot.entity.position;
    const playerPos = player.entity.position;
    const distance = botPos.distanceTo(playerPos);

    // If too far, get closer first
    if (distance > 5) {
      moveTowardsPlayerPrecise(botPos, playerPos, 3);
      return;
    }

    // Patrol in a small circle around player
    const time = Date.now() / 1000;
    const angle = time % (Math.PI * 2);
    const radius = 3;

    const targetX = playerPos.x + Math.cos(angle) * radius;
    const targetZ = playerPos.z + Math.sin(angle) * radius;
    const targetPos = { x: targetX, y: playerPos.y, z: targetZ };

    moveTowardsPlayerPrecise(botPos, targetPos, 0.5);

  } catch (error) {
    console.log('🔧 Lỗi patrol around player...');
  }
}

// NEW: Update bot screen data
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
        bot.inventory.slots[5]?.name || null, // helmet
        bot.inventory.slots[6]?.name || null, // chestplate
        bot.inventory.slots[7]?.name || null, // leggings
        bot.inventory.slots[8]?.name || null  // boots
      ] as (string | null)[]
    };
    botScreenData.lastUpdate = Date.now();

    // Send to all connected websocket clients if any
    // This will be handled by the web interface

  } catch (error) {
    // Ignore update errors
  }
}

// Chuyển đổi bất kỳ giá trị nào thành string an toàn
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

// Gửi chat an toàn với hàng đợi và delay
function safeChat(message: string) {
  if (!bot || !isConnected) {
    console.log('🔧 Không thể gửi chat, bot không kết nối hoặc chưa sẵn sàng.');
    return false;
  }

  chatQueue.push(message);
  processChatQueue();
  return true;
}

// Xử lý hàng đợi chat
function processChatQueue() {
  if (isChatting || chatQueue.length === 0) {
    return;
  }

  isChatting = true;
  const messageToSend = chatQueue.shift(); // Lấy tin nhắn đầu tiên từ hàng đợi

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
    processChatQueue(); // Xử lý tin nhắn tiếp theo sau delay
  }, CHAT_DELAY);
}

// Xử lý ngắt kết nối
function handleDisconnection(reason: string) {
  isConnected = false;
  stopCurrentActivity();
  console.log(`💔 Bot đã bị ngắt kết nối: ${reason || 'Unknown reason'}`);
  attemptReconnect();
}

// Xử lý lỗi bot với logic tốt hơn
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
    'failed to connect' // Added for more general connection issues
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
      }, 30000); // Wait longer for common connection issues
    }
    return;
  }

  isConnected = false;
  attemptReconnect();
}

// Thử kết nối lại với delay lớn hơn
function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.log('❌ Đã thử kết nối lại quá nhiều lần. Chờ 120 giây trước khi reset...');
    setTimeout(() => {
      reconnectAttempts = 0;
      console.log('🔄 Reset reconnect counter, thử lại...');
      createBot();
    }, 120000); // Increased wait time after max attempts
    return;
  }

  reconnectAttempts++;
  const delay = Math.min(10000 + (reconnectAttempts * 10000), 60000); // Start at 10s, increase by 10s up to 60s
  console.log(`🔄 Thử kết nối lại... (${reconnectAttempts}/${maxReconnectAttempts}) sau ${delay/1000}s`);

  setTimeout(() => {
    createBot();
  }, delay);
}

// Di chuyển ngẫu nhiên chỉ khi idle
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

// Nhảy múa chỉ khi idle
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

// Xử lý thoát chương trình
process.on('SIGINT', () => {
  console.log('🛑 Đang dừng Bot Lolicute...');
  isConnected = false;
  stopCurrentActivity();

  if (bot) {
    try {
      safeChat('Sayonara minna-san! (◕‿◕)ノ Hẹn gặp lại! 💕');
      // Give some time for the last chat message to be sent
      setTimeout(() => {
        bot.quit();
        process.exit(0);
      }, CHAT_DELAY + 1000); // Add extra time after chat delay
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

// Xử lý uncaught exceptions
process.on('uncaughtException', (error) => {
  console.log('🔧 Uncaught exception được xử lý:', error.message);
  // Attempt reconnect on uncaught exceptions as well
  isConnected = false;
  attemptReconnect();
});

process.on('unhandledRejection', (reason) => {
  console.log('🔧 Unhandled rejection được xử lý:', reason);
});

// Export bot screen data for API access
export function getBotScreenData() {
  return botScreenData;
}

// Export bot status for external monitoring
export function getBotStatus() {
  return {
    isConnected,
    currentMode,
    targetPlayer: targetPlayer?.username || null,
    reconnectAttempts,
    lastUpdate: Date.now()
  };
}

// ==================== NEW EXPLORATION FEATURES ====================

// Tự động khám phá với AI thông minh
function startAutoExplore() {
  if (exploringInterval) {
    clearInterval(exploringInterval);
  }

  console.log('🗺️ Bắt đầu khám phá thế giới với AI...');
  safeChat('Bắt đầu cuộc phiêu lưu! Tôi sẽ tìm rương, đánh quái, và lụm đồ! ✨🏃‍♀️');

  // Trang bị vũ khí tốt nhất
  equipBestWeapon();

  // State tracking cho exploration
  let lastAction = '';
  let actionStartTime = 0;
  let isPerformingAction = false;

  exploringInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'exploring') {
      clearInterval(exploringInterval!);
      return;
    }

    try {
      // Kiểm tra túi đồ có đầy không
      checkInventoryFullness();

      // Update activity time
      lastActivityTime = Date.now();

      // Chờ action hiện tại hoàn thành (tối đa 5 giây)
      if (isPerformingAction && Date.now() - actionStartTime < 5000) {
        console.log(`⏳ Đang thực hiện: ${lastAction}...`);
        return;
      }

      // Reset action state
      isPerformingAction = false;

      // Tìm mục tiêu ưu tiên với log chi tiết
      const nearbyTargets = findExplorationTargets();
      console.log(`🔍 Quét khu vực: Rương=${nearbyTargets.chests.length}, Quái=${nearbyTargets.mobs.length}, Đồ rơi=${nearbyTargets.drops.length}`);
      
      if (nearbyTargets.chests.length > 0 && !isInventoryFull) {
        // Ưu tiên rương chưa loot nếu túi chưa đầy
        console.log('📦 Tìm thấy rương chưa loot!');
        lastAction = 'loot chest';
        actionStartTime = Date.now();
        isPerformingAction = true;
        lootNearestChest(nearbyTargets.chests);
      } else if (nearbyTargets.mobs.length > 0) {
        // Đánh quái gần nhất
        console.log('⚔️ Phát hiện quái thù!');
        lastAction = 'attack mob';
        actionStartTime = Date.now();
        isPerformingAction = true;
        attackNearestMob(nearbyTargets.mobs);
      } else if (nearbyTargets.drops.length > 0 && !isInventoryFull) {
        // Lụm đồ rơi nếu túi chưa đầy
        console.log('💎 Phát hiện đồ rơi!');
        lastAction = 'collect drops';
        actionStartTime = Date.now();
        isPerformingAction = true;
        collectNearestDrop(nearbyTargets.drops);
      } else {
        // Di chuyển khám phá khi không có mục tiêu
        console.log('🚶 Không có mục tiêu, khám phá vùng mới...');
        lastAction = 'explore';
        actionStartTime = Date.now();
        isPerformingAction = true;
        exploreRandomDirection();
      }

      updateBotScreen();

    } catch (error) {
      console.log(`🔧 Lỗi trong exploration: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isPerformingAction = false;
    }
  }, 3000); // Check mỗi 3 giây để bot có thời gian hoàn thành action

  // Khởi động chế độ tự vệ song song
  startIdleMonitoring();
}

// Tìm các mục tiêu khám phá
function findExplorationTargets() {
  const position = bot.entity.position;
  const targets = {
    chests: [] as any[],
    mobs: [] as any[],
    drops: [] as any[]
  };

  try {
    // Tìm rương trong vòng 20 blocks (tăng phạm vi)
    for (let x = -20; x <= 20; x += 2) { // Bước nhảy 2 để tối ưu performance
      for (let y = -8; y <= 8; y++) {
        for (let z = -20; z <= 20; z += 2) {
          const checkPos = position.offset(x, y, z);
          
          // Bỏ qua công trình dưới y < 30 (tăng range)
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
            // Skip individual block errors
            continue;
          }
        }
      }
    }

    // Tìm quái trong vòng 15 blocks (tăng phạm vi)
    Object.values(bot.entities).forEach((entity: any) => {
      if (!entity || !entity.position || entity.id === bot.entity.id) return;
      
      const distance = position.distanceTo(entity.position);
      if (distance <= 15) {
        // Mở rộng danh sách quái thù
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

    // Tìm đồ rơi trong vòng 12 blocks (tăng phạm vi)
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

    // Sắp xếp theo khoảng cách
    targets.chests.sort((a, b) => a.distance - b.distance);
    targets.mobs.sort((a, b) => a.distance - b.distance);
    targets.drops.sort((a, b) => a.distance - b.distance);

  } catch (error) {
    console.log(`🔧 Lỗi tìm targets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return targets;
}

// Loot rương gần nhất
function lootNearestChest(chests: any[]) {
  if (!chests.length) return;

  const nearestChest = chests[0]; // Đã được sort trong findExplorationTargets

  console.log(`📦 Tìm thấy ${nearestChest.type} tại (${Math.floor(nearestChest.position.x)}, ${Math.floor(nearestChest.position.y)}, ${Math.floor(nearestChest.position.z)})! Đang loot...`);
  safeChat(`Kyaa! Tìm thấy ${nearestChest.type}! Có gì hay ho không nhỉ? 📦✨`);

  try {
    // Dừng mọi movement trước
    bot.clearControlStates();
    
    // Di chuyển đến rương với pathfinder
    if (bot.pathfinder && goals) {
      const goal = new goals.GoalBlock(
        Math.floor(nearestChest.position.x),
        Math.floor(nearestChest.position.y),
        Math.floor(nearestChest.position.z)
      );
      bot.pathfinder.setGoal(goal);
      
      // Chờ đến gần rương
      bot.pathfinder.on('goal_reached', async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 500)); // Đợi 0.5s
          
          const chest = bot.blockAt(nearestChest.position);
          if (!chest || (!chest.name.includes('chest') && !chest.name.includes('shulker'))) {
            console.log('🔧 Không tìm thấy rương tại vị trí');
            exploredChests.add(nearestChest.key);
            return;
          }

          console.log(`📦 Đang mở ${chest.name}...`);
          const window = await bot.openChest(chest);
          
          let itemCount = 0;
          const itemsLooted: string[] = [];
          
          // Loot từng item một cách thông minh
          for (let i = 0; i < window.slots.length; i++) {
            const item = window.slots[i];
            if (item && bot.inventory.emptySlotCount() > 2) { // Giữ 2 slot trống
              try {
                await window.withdraw(item.type, null, item.count);
                itemsLooted.push(`${item.displayName || item.name} x${item.count}`);
                itemCount += item.count;
                await new Promise(resolve => setTimeout(resolve, 100)); // Delay nhỏ giữa các lần loot
              } catch (withdrawError) {
                console.log(`🔧 Không thể lấy ${item.displayName || item.name}`);
              }
            }
          }
          
          window.close();
          
          // Đánh dấu rương đã loot
          exploredChests.add(nearestChest.key);
          
          if (itemCount > 0) {
            console.log(`✅ Loot thành công ${itemCount} items: ${itemsLooted.slice(0, 3).join(', ')}${itemsLooted.length > 3 ? '...' : ''}`);
            safeChat(`Loot xong rương! Lấy được ${itemCount} đồ hay! (◕‿◕)♡ ${itemsLooted.slice(0, 2).join(', ')}`);
          } else {
            safeChat('Rương rỗng hoặc túi đầy rồi! (╥﹏╥)');
          }
          
        } catch (openError) {
          console.log(`🔧 Lỗi mở rương: ${openError instanceof Error ? openError.message : 'Unknown error'}`);
          exploredChests.add(nearestChest.key); // Đánh dấu để bỏ qua
        }
      });
      
    } else {
      // Fallback: đi thẳng đến rương
      bot.lookAt(nearestChest.position);
      bot.setControlState('forward', true);
      setTimeout(() => {
        bot.setControlState('forward', false);
        // Thử mở rương sau khi di chuyển
        setTimeout(async () => {
          try {
            const chest = bot.blockAt(nearestChest.position);
            if (chest) {
              const window = await bot.openChest(chest);
              // Simple loot all
              for (let i = 0; i < window.slots.length; i++) {
                const item = window.slots[i];
                if (item) {
                  await window.withdraw(item.type, null, item.count);
                }
              }
              window.close();
              exploredChests.add(nearestChest.key);
              safeChat('Loot xong rương rồi! (◕‿◕)♡');
            }
          } catch (error) {
            exploredChests.add(nearestChest.key);
          }
        }, 1000);
      }, 2000);
    }

  } catch (error) {
    console.log(`🔧 Lỗi loot chest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    exploredChests.add(nearestChest.key); // Đánh dấu để bỏ qua
  }
}

// Tấn công quái gần nhất
function attackNearestMob(mobs: any[]) {
  if (!mobs.length) return;

  const nearestMob = mobs[0]; // Đã được sort trong findExplorationTargets

  console.log(`⚔️ Tấn công ${nearestMob.type}!`);
  
  // Chat delay cho combat messages (5 giây)
  const now = Date.now();
  if (now - lastCombatChatTime > 5000) {
    safeChat(`Quái ${nearestMob.type}! Coi chừng nhé! (ง •̀_•́)ง✨`);
    lastCombatChatTime = now;
  }

  try {
    // Trang bị vũ khí tối ưu
    equipBestWeapon();

    // Tấn công
    bot.attack(nearestMob.entity);

    // Set goal tới quái
    if (bot.pathfinder) {
      bot.pathfinder.setGoal(new goals.GoalFollow(nearestMob.entity, 1));
    }

    // Update screen
    botScreenData.status = `Đang tấn công ${nearestMob.type}`;

  } catch (error) {
    console.log('🔧 Lỗi attack mob');
  }
}

// Lụm đồ rơi gần nhất
function collectNearestDrop(drops: any[]) {
  if (!drops.length) return;

  const nearestDrop = drops[0]; // Đã được sort trong findExplorationTargets

  console.log(`💎 Thu thập đồ rơi: ${nearestDrop.item || 'Unknown Item'} (${nearestDrop.distance.toFixed(1)}m)...`);
  safeChat(`Uwaa! Có đồ rơi! Lụm đi nào! 💎✨ ${nearestDrop.item || 'Cái gì đó'}`);

  try {
    // Dừng mọi movement trước
    bot.clearControlStates();
    
    // Di chuyển đến đồ rơi với pathfinder
    if (bot.pathfinder && goals && nearestDrop.entity) {
      // Sử dụng GoalFollow để theo sát item (items có thể di chuyển)
      const goal = new goals.GoalFollow(nearestDrop.entity, 0.5);
      bot.pathfinder.setGoal(goal);
      
      // Theo dõi việc di chuyển
      let collectTimeout = setTimeout(() => {
        // Nếu quá 5 giây chưa thu thập được, chuyển sang mục tiêu khác
        console.log('⏰ Timeout thu thập item, chuyển sang mục tiêu khác');
        if (bot.pathfinder) {
          bot.pathfinder.setGoal(null);
        }
      }, 5000);
      
      // Lắng nghe sự kiện collect item
      const onItemPickup = (item: any) => {
        if (item && item.position && nearestDrop.entity.position) {
          const distance = item.position.distanceTo(nearestDrop.entity.position);
          if (distance < 2) { // Item gần vị trí đồ rơi
            console.log(`✅ Thu thập thành công: ${item.displayName || item.name} x${item.count || 1}`);
            safeChat(`Lụm được ${item.displayName || item.name}! Yay! (◕‿◕)♡`);
            clearTimeout(collectTimeout);
            bot.off('collect', onItemPickup);
            
            // Cập nhật status
            botScreenData.status = `Thu thập: ${item.displayName || item.name}`;
          }
        }
      };
      
      bot.once('collect', onItemPickup);
      
    } else {
      // Fallback: di chuyển đơn giản
      if (nearestDrop.entity && nearestDrop.entity.position) {
        bot.lookAt(nearestDrop.entity.position);
        
        // Di chuyển thẳng về phía item
        const dx = nearestDrop.entity.position.x - bot.entity.position.x;
        const dz = nearestDrop.entity.position.z - bot.entity.position.z;
        
        if (Math.abs(dx) > Math.abs(dz)) {
          bot.setControlState(dx > 0 ? 'forward' : 'back', true);
          if (dz > 0) bot.setControlState('right', true);
          else if (dz < 0) bot.setControlState('left', true);
        } else {
          bot.setControlState(dz > 0 ? 'right' : 'left', true);
          if (dx > 0) bot.setControlState('forward', true);
          else if (dx < 0) bot.setControlState('back', true);
        }
        
        // Dừng di chuyển after 3 seconds
        setTimeout(() => {
          bot.clearControlStates();
        }, 3000);
      }
    }
    
    botScreenData.status = `Thu thập: ${nearestDrop.item || 'đồ rơi'}`;

  } catch (error) {
    console.log(`🔧 Lỗi collect drop: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Khám phá hướng ngẫu nhiên
function exploreRandomDirection() {
  try {
    // Kiểm tra bot có sẵn sàng không
    if (!bot || !bot.entity || !bot.entity.position) {
      console.log('🔧 Bot chưa sẵn sàng để khám phá');
      return;
    }

    const position = bot.entity.position;
    const directions = [
      { x: 20, z: 0 },   // East
      { x: -20, z: 0 },  // West  
      { x: 0, z: 20 },   // South
      { x: 0, z: -20 },  // North
      { x: 15, z: 15 },  // SE
      { x: -15, z: 15 }, // SW
      { x: 15, z: -15 }, // NE
      { x: -15, z: -15 } // NW
    ];

    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const targetPos = {
      x: position.x + randomDir.x,
      y: position.y,
      z: position.z + randomDir.z
    };

    // Tìm y tối ưu (mặt đất)
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
        // Ignore individual block errors
        continue;
      }
    }

    console.log(`🚶 Khám phá hướng mới: ${targetPos.x}, ${targetPos.z}`);
    
    // Kiểm tra pathfinder có sẵn sàng
    if (bot.pathfinder && goals && goals.GoalNear) {
      try {
        bot.pathfinder.setGoal(new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 1));
      } catch (pathError) {
        console.log('🔧 Lỗi pathfinder, dùng movement đơn giản');
        simpleMovement(randomDir);
      }
    } else {
      simpleMovement(randomDir);
    }
    
    botScreenData.status = `Khám phá hướng (${targetPos.x}, ${targetPos.z})`;

  } catch (error) {
    console.log(`🔧 Lỗi explore direction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Fallback movement
    const actions = ['forward', 'left', 'right'] as const;
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    bot.setControlState(randomAction, true);
    setTimeout(() => {
      bot.setControlState(randomAction, false);
    }, 2000);
  }
}

// Simple movement fallback
function simpleMovement(direction: { x: number, z: number }) {
  try {
    if (direction.x > 0) {
      bot.setControlState('forward', true);
      bot.setControlState('right', true);
    } else if (direction.x < 0) {
      bot.setControlState('forward', true);
      bot.setControlState('left', true);
    } else if (direction.z > 0) {
      bot.setControlState('forward', true);
    } else {
      bot.setControlState('back', true);
    }
    
    setTimeout(() => {
      bot.clearControlStates();
    }, 3000);
  } catch (error) {
    console.log('🔧 Lỗi simple movement');
  }
}

// Trang bị vũ khí tốt nhất
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

// Kiểm tra túi đồ có đầy không
function checkInventoryFullness() {
  try {
    const emptySlots = bot.inventory.emptySlotCount();
    isInventoryFull = emptySlots <= 3; // Considered full if ≤3 empty slots

    if (isInventoryFull && currentMode === 'exploring') {
      safeChat('Túi đồ đầy rồi! Chuyển sang chế độ giết quái thôi! (ง •̀_•́)ง💪');
      // Không dừng exploration, chỉ tập trung vào combat
      console.log('💼 Túi đồ đầy - chuyển sang combat mode');
    }

    botScreenData.status = isInventoryFull ? 'Túi đầy - Combat mode' : 'Đang khám phá';

  } catch (error) {
    console.log('🔧 Lỗi check inventory');
  }
}

// ==================== SELF DEFENSE SYSTEM ====================

// Khởi động giám sát thời gian idle cho tự vệ
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

    // Nếu không có lệnh nào trong 3 phút, kích hoạt tự vệ
    if (timeSinceLastActivity >= IDLE_TIMEOUT && currentMode === 'idle') {
      console.log('🛡️ Kích hoạt chế độ tự vệ sau 3 phút idle');
      safeChat('Đã 3 phút rồi! Tôi sẽ tự bảo vệ bản thân khỏi quái! 🛡️⚔️');
      
      currentMode = 'self_defense';
      startSelfDefense();
    }

  }, 30000); // Check mỗi 30 giây
}

// Chế độ tự vệ
function startSelfDefense() {
  console.log('🛡️ Bắt đầu chế độ tự vệ...');
  
  const selfDefenseLoop = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'self_defense') {
      clearInterval(selfDefenseLoop);
      return;
    }

    try {
      // Trang bị vũ khí tốt nhất
      equipBestWeapon();

      // Tìm quái gần để tự vệ
      const nearbyThreats = findNearbyThreats();
      
      if (nearbyThreats.length > 0) {
        const nearestThreat = nearbyThreats[0];
        console.log(`🛡️ Tự vệ khỏi ${nearestThreat.type}!`);
        safeChat(`${nearestThreat.type} đến gần! Tôi phải tự vệ! (ง •̀_•́)ง`);
        
        // Tấn công để tự vệ
        bot.attack(nearestThreat.entity);
        if (bot.pathfinder) {
          bot.pathfinder.setGoal(new goals.GoalFollow(nearestThreat.entity, 1));
        }
        
        botScreenData.status = `Tự vệ khỏi ${nearestThreat.type}`;
      } else {
        // An toàn, di chuyển nhẹ
        performDefensiveMovement();
        botScreenData.status = 'Chế độ tự vệ - An toàn';
      }

      updateBotScreen();

    } catch (error) {
      console.log('🔧 Lỗi self defense:', error.message);
    }
  }, 2000);
}

// Tìm mối đe dọa gần
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

    // Sắp xếp theo khoảng cách
    threats.sort((a, b) => a.distance - b.distance);

  } catch (error) {
    console.log('🔧 Lỗi find threats');
  }

  return threats;
}

// Di chuyển phòng thủ
function performDefensiveMovement() {
  try {
    const actions = ['left', 'right', 'jump'] as const;
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    
    bot.setControlState(randomAction, true);
    setTimeout(() => {
      bot.setControlState(randomAction, false);
    }, 1000);

    // Luôn nhìn xung quanh
    const randomYaw = Math.random() * Math.PI * 2;
    bot.look(randomYaw, 0);

  } catch (error) {
    console.log('🔧 Lỗi defensive movement');
  }
}

// ==================== NEW FEATURES ====================

// Kiểm tra inventory có item không - CẢI THIỆN
function checkInventoryForItem(itemName: string) {
  try {
    let totalCount = 0;
    let foundItems: any[] = [];
    
    // Chuyển đổi tên item phổ biến
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
      
      // Kiểm tra tên chính xác hoặc chứa từ khóa
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

// Ném đồ cho player
function giveItemToPlayer(username: string, itemName: string, amount: number) {
  try {
    const player = bot.players[username];
    if (!player || !player.entity) {
      safeChat(`${username}-chan không gần đây! Em không ném được! (´;ω;)`);
      return;
    }
    
    // Tìm item trong inventory
    const itemCheck = checkInventoryForItem(itemName);
    if (!itemCheck.hasItem || itemCheck.count < amount) {
      safeChat(`Gomen ${username}-chan! Em không đủ ${itemName}! Chỉ có ${itemCheck.count}! (´;ω;)`);
      return;
    }
    
    // Toss items
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

// Trang bị cuốc tốt nhất
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

// Bắt đầu auto mining
function startAutoMining(oreType: string) {
  if (miningInterval) {
    clearInterval(miningInterval);
  }
  
  console.log(`⛏️ Bắt đầu đào ${oreType} ore...`);
  
  // Trang bị cuốc tốt nhất
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
      // Kiểm tra túi đồ đầy
      checkInventoryFullness();
      
      // Update activity time
      lastActivityTime = Date.now();
      
      // Tìm ore gần nhất
      const nearbyOres = findNearbyOres(oreType);
      
      if (nearbyOres.length > 0) {
        mineNearestOre(nearbyOres[0]);
      } else {
        // Di chuyển tìm ore
        exploreForOres(oreType);
      }
      
      updateBotScreen();
      
    } catch (error) {
      console.log(`🔧 Lỗi trong mining: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, 2000); // Check mỗi 2 giây
}

// Tìm ore gần đây
function findNearbyOres(oreType: string) {
  const position = bot.entity.position;
  const ores: any[] = [];
  
  try {
    // Mapping ore types to block names
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
    
    // Quét vùng 10x10x10 xung quanh bot
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
    
    // Sắp xếp theo khoảng cách
    ores.sort((a, b) => a.distance - b.distance);
    
  } catch (error) {
    console.log(`🔧 Lỗi tìm ore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return ores;
}

// Đào ore gần nhất
function mineNearestOre(ore: any) {
  console.log(`⛏️ Đào ${ore.type} tại (${Math.floor(ore.position.x)}, ${Math.floor(ore.position.y)}, ${Math.floor(ore.position.z)})`);
  
  try {
    // Di chuyển đến ore
    if (bot.pathfinder && goals) {
      const goal = new goals.GoalBlock(
        Math.floor(ore.position.x),
        Math.floor(ore.position.y),
        Math.floor(ore.position.z)
      );
      bot.pathfinder.setGoal(goal);
    }
    
    // Đào sau 2 giây
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

// Khám phá tìm ore
function exploreForOres(oreType: string) {
  try {
    const position = bot.entity.position;
    let targetY = position.y;
    
    // Set optimal Y level for different ores
    const optimalYLevels: { [key: string]: number } = {
      'iron': 15,
      'gold': 15,
      'diamond': -54,
      'copper': 48,
      'emerald': -54,
      'coal': 96,
      'netherite': 15 // Nether Y level
    };
    
    targetY = optimalYLevels[oreType] || position.y;
    
    // Random direction at optimal Y level
    const directions = [
      { x: 10, z: 0 },   // East
      { x: -10, z: 0 },  // West  
      { x: 0, z: 10 },   // South
      { x: 0, z: -10 }   // North
    ];
    
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    const targetPos = {
      x: position.x + randomDir.x,
      y: targetY,
      z: position.z + randomDir.z
    };
    
    console.log(`🔍 Tìm ${oreType} ore tại Y=${targetY}: (${targetPos.x}, ${targetPos.z})`);
    
    if (bot.pathfinder && goals) {
      bot.pathfinder.setGoal(new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, 1));
    }
    
    botScreenData.status = `Tìm ${oreType} ore tại Y=${targetY}`;
    
  } catch (error) {
    console.log(`🔧 Lỗi explore for ores: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Hiển thị inventory cho player
function showInventoryToPlayer(username: string) {
  try {
    const items = bot.inventory.items();
    if (items.length === 0) {
      safeChat(`${username}-chan! Em không có đồ gì cả! (´;ω;) Túi rỗng luôn!`);
      return;
    }
    
    // Nhóm items theo loại
    const itemGroups: { [key: string]: number } = {};
    for (const item of items) {
      const itemName = item.displayName || item.name;
      itemGroups[itemName] = (itemGroups[itemName] || 0) + item.count;
    }
    
    // Tạo danh sách 5 items đầu tiên
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

// ==================== NEW SURVIVAL FUNCTIONS ====================

// Health recovery system 
function startHealthRecovery() {
  try {
    safeChat('Chế độ phục hồi máu! Tôi sẽ tìm chỗ an toàn và ăn để hồi máu! 🏥');
    currentMode = 'health_recovery';
    
    // Dừng tất cả activity
    bot.clearControlStates();
    
    // Tìm và ăn food nếu có
    attemptSelfFeeding();
    
    // Tránh xa monsters
    const threats = findNearbyThreats();
    if (threats.length > 0) {
      // Run away from threats
      runAwayFromThreats(threats);
    } else {
      // Find safe spot
      findSafeSpot();
    }
    
  } catch (error) {
    console.log('🔧 Lỗi health recovery...');
  }
}

// Resume previous activity after health recovery
function resumePreviousActivity() {
  if (previousActivity && previousActivity !== 'idle') {
    safeChat(`Khỏe rồi! Tôi sẽ tiếp tục ${previousActivity}! (◕‿◕)♡`);
    currentMode = previousActivity;
    lastActivityTime = Date.now();
    
    // Restart appropriate activity
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

// Auto feeding system
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

// Run away from threats when low health
function runAwayFromThreats(threats: any[]) {
  try {
    const nearestThreat = threats[0];
    const botPos = bot.entity.position;
    const threatPos = nearestThreat.entity.position;
    
    // Calculate escape direction (opposite of threat)
    const escapeX = botPos.x - threatPos.x;
    const escapeZ = botPos.z - threatPos.z;
    const distance = Math.sqrt(escapeX*escapeX + escapeZ*escapeZ);
    
    if (distance > 0) {
      const normalizedX = escapeX / distance;
      const normalizedZ = escapeZ / distance;
      
      // Move away
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

// Find safe spot for recovery
function findSafeSpot() {
  try {
    // Look for well-lit areas or underground spaces
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
      
      // Try to move to safer area
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

// Return to dropped items after death
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
      
      // Set timeout to stop if taking too long
      setTimeout(() => {
        if (currentMode === 'item_recovery') {
          safeChat('Hết thời gian tìm đồ rớt! Có thể đã despawn rồi! (´;ω;)');
          stopCurrentActivity();
          droppedItemsLocation = null;
          isReturningToDrops = false;
        }
      }, 30000); // 30 seconds timeout
    }
    
  } catch (error) {
    console.log('🔧 Lỗi return to drops...');
  }
}

// Smart exploration with better AI
function startSmartExplore() {
  if (movementInterval) {
    clearInterval(movementInterval);
  }
  
  safeChat('Bắt đầu khám phá thông minh! Tránh lá cây, dùng tools hợp lý! 🗺️✨');
  
  movementInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'exploring') {
      clearInterval(movementInterval!);
      return;
    }
    
    try {
      // Check health and food first
      if (bot.health <= 6 || bot.food <= 6) {
        safeChat('Cần nghỉ ngơi! Dừng khám phá để chăm sóc bản thân!');
        stopCurrentActivity();
        return;
      }
      
      // Auto equip best gear
      equipBestGear();
      
      // Find targets with improved priority
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

// Intelligent exploration avoiding leaves and using tools
function exploreIntelligently() {
  try {
    const position = bot.entity.position;
    const front = bot.blockAt(position.offset(0, 0, 1));
    const above = bot.blockAt(position.offset(0, 1, 0));
    
    // Check for obstacles that need tools
    if (front && useToolsForObstacles) {
      if (front.name.includes('log') || front.name.includes('wood')) {
        equipBestAxe();
        bot.dig(front);
        safeChat('Chặt cây để đi qua! 🪓');
        return;
      } else if (front.name.includes('stone') || front.name.includes('ore')) {
        equipBestPickaxe();
        bot.dig(front);
        safeChat('Đào đá để làm đường! ⛏️');
        return;
      }
    }
    
    // Avoid leaves if setting is enabled
    if (avoidLeaves && front && front.name.includes('leaves')) {
      // Try to go around leaves
      const alternativeDirections = ['left', 'right', 'back'] as const;
      const randomDir = alternativeDirections[Math.floor(Math.random() * alternativeDirections.length)];
      bot.setControlState(randomDir, true);
      setTimeout(() => bot.setControlState(randomDir, false), 1000);
      return;
    }
    
    // Normal smart movement
    exploreRandomDirection();
    
  } catch (error) {
    console.log('🔧 Lỗi intelligent explore...');
    exploreRandomDirection(); // Fallback
  }
}

// Enhanced mining system with torch placement
function startAutoMining(oreType: string) {
  if (movementInterval) {
    clearInterval(movementInterval);
  }
  
  currentMiningDepth = 0;
  lastTorchPosition = null;
  
  safeChat(`Bắt đầu đào ${oreType} thông minh! Có đặt đuốc và staircase pattern! ⛏️✨`);
  
  // Auto equip best pickaxe
  equipBestPickaxe();
  
  movementInterval = setInterval(() => {
    if (!isConnected || !bot || currentMode !== 'mining') {
      clearInterval(movementInterval!);
      return;
    }
    
    try {
      // Health and food check
      if (bot.health <= 8 || bot.food <= 8) {
        safeChat('Cần nghỉ ngơi! Dừng đào để chăm sóc bản thân!');
        stopCurrentActivity();
        return;
      }
      
      // Check for torches placement
      placeTorchIfNeeded();
      
      // Mine intelligently
      performIntelligentMining(oreType);
      
      updateBotScreen();
      
    } catch (error) {
      console.log('🔧 Lỗi smart mining...');
    }
  }, 2000);
}

// Intelligent mining with staircase pattern and torch placement
function performIntelligentMining(oreType: string) {
  try {
    const position = bot.entity.position;
    const targetY = getOptimalMiningDepth(oreType);
    
    // First priority: Find the target ore nearby
    const targetOreBlock = findNearbyOre(oreType, 8);
    if (targetOreBlock) {
      safeChat(`Tìm thấy ${oreType}! Đào ngay! ⛏️💎`);
      bot.dig(targetOreBlock);
      return;
    }
    
    // If at target depth, mine horizontally
    if (Math.abs(position.y - targetY) <= 2) {
      mineHorizontally();
    } else if (position.y > targetY) {
      // Need to go deeper - use staircase pattern
      mineStaircaseDown();
    } else {
      // Too deep - go up
      mineStaircaseUp();
    }
    
  } catch (error) {
    console.log('🔧 Lỗi intelligent mining...');
  }
}

// Get optimal depth for different ores
function getOptimalMiningDepth(oreType: string) {
  const depths: { [key: string]: number } = {
    'diamond': -54,
    'iron': -16,
    'gold': -32,
    'copper': 48,
    'coal': 48,
    'emerald': -16,
    'netherite': 15 // Nether Y level
  };
  return depths[oreType] || -16;
}

// Find nearby ore blocks
function findNearbyOre(oreType: string, radius: number) {
  try {
    const position = bot.entity.position;
    
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
          const checkPos = position.offset(x, y, z);
          const block = bot.blockAt(checkPos);
          
          if (block && block.name.includes(oreType) && block.name.includes('ore')) {
            return block;
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.log('🔧 Lỗi find nearby ore...');
    return null;
  }
}

// Mine in staircase pattern going down
function mineStaircaseDown() {
  try {
    const position = bot.entity.position;
    const frontBlock = bot.blockAt(position.offset(0, 0, 1));
    const downBlock = bot.blockAt(position.offset(0, -1, 1));
    
    if (frontBlock && frontBlock.name !== 'air') {
      bot.dig(frontBlock);
    }
    if (downBlock && downBlock.name !== 'air') {
      bot.dig(downBlock);
    }
    
    // Move forward after digging
    setTimeout(() => {
      bot.setControlState('forward', true);
      setTimeout(() => bot.setControlState('forward', false), 500);
    }, 1000);
    
    currentMiningDepth++;
    
  } catch (error) {
    console.log('🔧 Lỗi staircase down...');
  }
}

// Mine horizontally when at target depth  
function mineHorizontally() {
  try {
    const directions = ['forward', 'left', 'right', 'back'] as const;
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    
    const position = bot.entity.position;
    const directionOffsets = {
      forward: { x: 0, y: 0, z: 1 },
      back: { x: 0, y: 0, z: -1 },
      left: { x: -1, y: 0, z: 0 },
      right: { x: 1, y: 0, z: 0 }
    };
    
    const offset = directionOffsets[randomDir];
    const targetBlock = bot.blockAt(position.offset(offset.x, offset.y, offset.z));
    
    if (targetBlock && targetBlock.name !== 'air') {
      bot.dig(targetBlock);
      
      // Move in that direction
      setTimeout(() => {
        bot.setControlState(randomDir, true);
        setTimeout(() => bot.setControlState(randomDir, false), 1000);
      }, 500);
    }
    
  } catch (error) {
    console.log('🔧 Lỗi horizontal mining...');
  }
}

// Place torches when needed
function placeTorchIfNeeded() {
  try {
    const position = bot.entity.position;
    
    // Check if we need to place a torch (every 7 blocks distance)
    if (!lastTorchPosition || position.distanceTo(lastTorchPosition) >= torchPlacementDistance) {
      const torches = bot.inventory.items().filter((item: any) => item.name.includes('torch'));
      
      if (torches.length > 0) {
        const torch = torches[0];
        bot.equip(torch, 'hand');
        
        // Find suitable place for torch (wall or ground)
        const wallBlock = bot.blockAt(position.offset(1, 0, 0)) || 
                         bot.blockAt(position.offset(-1, 0, 0)) ||
                         bot.blockAt(position.offset(0, 0, 1)) ||
                         bot.blockAt(position.offset(0, 0, -1));
                         
        if (wallBlock && wallBlock.name !== 'air') {
          bot.placeBlock(wallBlock, bot.vec3(0, 1, 0));
          lastTorchPosition = { ...position };
          safeChat('Đặt đuốc để sáng! 🕯️');
        }
      }
    }
  } catch (error) {
    console.log('🔧 Lỗi place torch...');
  }
}

// Equip best pickaxe
function equipBestPickaxe() {
  try {
    const pickaxes = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'wooden_pickaxe'];
    
    for (const pickaxe of pickaxes) {
      const item = bot.inventory.findInventoryItem(pickaxe);
      if (item) {
        bot.equip(item, 'hand');
        botScreenData.equipment.tool = pickaxe;
        return;
      }
    }
  } catch (error) {
    console.log('🔧 Lỗi equip pickaxe...');
  }
}

// Equip best axe
function equipBestAxe() {
  try {
    const axes = ['netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe', 'wooden_axe'];
    
    for (const axe of axes) {
      const item = bot.inventory.findInventoryItem(axe);
      if (item) {
        bot.equip(item, 'hand');
        botScreenData.equipment.tool = axe;
        return;
      }
    }
  } catch (error) {
    console.log('🔧 Lỗi equip axe...');
  }
}

// Chest hunting system
function startChestHunting() {
  if (movementInterval) {
    clearInterval(movementInterval);
  }
  
  foundChests = [];
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
        // Move to explore more area for chests
        exploreForChests();
      }
      
      updateBotScreen();
      
    } catch (error) {
      console.log('🔧 Lỗi chest hunting...');
    }
  }, 3000);
}

// Find chests in area
function findNearbyChests() {
  const chests: any[] = [];
  const position = bot.entity.position;
  
  try {
    // Search in chunks around bot
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
    
    // Sort by distance
    chests.sort((a, b) => a.distance - b.distance);
    
  } catch (error) {
    console.log('🔧 Lỗi find chests...');
  }
  
  return chests;
}

// Explore specifically for chests
function exploreForChests() {
  try {
    // Move in expanding square pattern to find chests
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

// AI Building system
function startAutoBuilding(project: string, username: string) {
  try {
    safeChat(`Để tôi dùng AI thiết kế ${project}! Chờ một chút nhé! 🧠✨`);
    
    // Call Gemini AI to get building plan
    generateBuildingPlan(project, username).then(plan => {
      buildingPlan = plan;
      buildingMode = true;
      safeChat(`AI đã thiết kế xong! Bắt đầu xây ${project}! 🏗️`);
      executeBuildingPlan(plan);
    }).catch(error => {
      console.log('🔧 Lỗi generate building plan:', error);
      safeChat(`Gomen ${username}-chan! AI không thể thiết kế ${project}! (´;ω;)`);
    });
    
  } catch (error) {
    console.log('🔧 Lỗi start auto building...');
  }
}

// Generate building plan using AI
async function generateBuildingPlan(project: string, username: string) {
  try {
    // This would call Gemini AI to generate a building plan
    // For now, return a simple plan structure
    return {
      name: project,
      blocks: [
        { type: 'oak_planks', positions: [{ x: 0, y: 0, z: 0 }] },
        // More building blocks would be generated by AI
      ],
      steps: [
        'Place foundation',
        'Build walls', 
        'Add roof',
        'Interior decoration'
      ]
    };
  } catch (error) {
    console.log('🔧 Lỗi generate building plan...');
    throw error;
  }
}

// Execute the building plan
function executeBuildingPlan(plan: any) {
  try {
    if (!plan || !plan.blocks) return;
    
    safeChat(`Thực hiện kế hoạch xây dựng ${plan.name}! 🏗️`);
    
    // Switch to creative mode for building
    bot.chat('/gamemode creative');
    
    let blockIndex = 0;
    const buildInterval = setInterval(() => {
      if (!buildingMode || !bot || !isConnected || blockIndex >= plan.blocks.length) {
        clearInterval(buildInterval);
        if (blockIndex >= plan.blocks.length) {
          safeChat(`Xây xong ${plan.name} rồi! Đẹp không? (◕‿◕)♡`);
          bot.chat(`/gamemode ${originalGameMode}`); // Switch back
        }
        buildingMode = false;
        return;
      }
      
      const blockData = plan.blocks[blockIndex];
      // Place block logic would go here
      // bot.setBlock(position, blockType)
      
      blockIndex++;
    }, 1000);
    
  } catch (error) {
    console.log('🔧 Lỗi execute building plan...');
  }
}

// Enhanced targeting for smart exploration
function findSmartExplorationTargets() {
  const targets = {
    chests: [] as any[],
    drops: [] as any[],
    mobs: [] as any[]
  };
  
  try {
    const position = bot.entity.position;
    
    // Find all entities and blocks in range
    Object.values(bot.entities).forEach((entity: any) => {
      if (!entity || !entity.position) return;
      
      const distance = position.distanceTo(entity.position);
      if (distance > 32) return; // Max search range
      
      // Categorize entities
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
    
    // Find chests by scanning blocks (more resource intensive but thorough)
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
    
    // Sort all targets by distance
    targets.chests.sort((a, b) => a.distance - b.distance);
    targets.drops.sort((a, b) => a.distance - b.distance);
    targets.mobs.sort((a, b) => a.distance - b.distance);
    
  } catch (error) {
    console.log('🔧 Lỗi find smart targets...');
  }
  
  return targets;
}

// Mine in staircase pattern going up
function mineStaircaseUp() {
  try {
    const position = bot.entity.position;
    const frontBlock = bot.blockAt(position.offset(0, 0, 1));
    const upBlock = bot.blockAt(position.offset(0, 1, 1));
    
    if (frontBlock && frontBlock.name !== 'air') {
      bot.dig(frontBlock);
    }
    if (upBlock && upBlock.name !== 'air') {
      bot.dig(upBlock);
    }
    
    // Move forward and jump after digging
    setTimeout(() => {
      bot.setControlState('forward', true);
      bot.setControlState('jump', true);
      setTimeout(() => {
        bot.setControlState('forward', false);
        bot.setControlState('jump', false);
      }, 500);
    }, 1000);
    
    currentMiningDepth--;
    
  } catch (error) {
    console.log('🔧 Lỗi staircase up...');
  }
}

// Gemini AI integration for questions
async function answerQuestion(question: string, username: string) {
  try {
    // This would integrate with Gemini API
    // For now, return a simple response
    return `${username}-chan! Câu hỏi hay quá! Về "${question}", tôi nghĩ... hmm... Tôi cần học thêm để trả lời tốt hơn! (◕‿◕)♡`;
  } catch (error) {
    console.log('🔧 Lỗi answer question...');
    throw error;
  }
}

// Gemini AI integration for task help
async function helpWithTask(task: string, username: string) {
  try {
    // This would integrate with Gemini API for task guidance
    return `${username}-chan! Để làm "${task}", tôi suggest: Bước 1: Chuẩn bị nguyên liệu. Bước 2: Lên kế hoạch. Bước 3: Thực hiện từng bước nhỏ! Chúc bạn thành công! ✨`;
  } catch (error) {
    console.log('🔧 Lỗi help with task...');
    throw error;
  }
}

// Gemini AI for loli chat responses
async function generateLoliResponse(message: string, username: string) {
  try {
    // This would use Gemini to generate kawaii responses
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

// Patrol around player for protection
function patrolAroundPlayer(player: any) {
  try {
    if (!player || !player.entity) return;
    
    const playerPos = player.entity.position;
    const botPos = bot.entity.position;
    const distance = botPos.distanceTo(playerPos);
    
    // Keep patrol distance of 3-5 blocks
    if (distance > 5) {
      // Move closer to player
      moveTowardsPlayerPrecise(botPos, playerPos, 4);
    } else if (distance < 3) {
      // Move away to maintain patrol distance
      moveAwayFromTarget(botPos, playerPos, 4);
    } else {
      // Circle around player
      const angle = Date.now() * 0.001; // Rotating angle
      const patrolRadius = 4;
      const targetX = playerPos.x + Math.cos(angle) * patrolRadius;
      const targetZ = playerPos.z + Math.sin(angle) * patrolRadius;
      const targetPos = { x: targetX, y: playerPos.y, z: targetZ };
      
      moveTowardsPlayerPrecise(botPos, targetPos, 1);
    }
    
    // Always look towards potential threats
    bot.lookAt(playerPos);
    
  } catch (error) {
    console.log('🔧 Lỗi patrol around player...');
  }
}

// Give item to player
function giveItemToPlayer(username: string, itemName: string, amount: number) {
  try {
    const item = bot.inventory.items().find((item: any) => 
      item.name.toLowerCase().includes(itemName.toLowerCase())
    );
    
    if (item && item.count >= amount) {
      // Drop the item near the player
      bot.toss(item.type, null, amount);
      safeChat(`Đã ném ${amount} ${itemName} cho ${username}-chan! Lụm nhanh nhé! 💕`);
      console.log(`🎁 Gave ${amount} ${itemName} to ${username}`);
    } else {
      safeChat(`Gomen ${username}-chan! Em không đủ ${itemName} để cho! (´;ω;)`);
    }
    
  } catch (error) {
    console.log('🔧 Lỗi give item...');
    safeChat(`Lỗi khi ném đồ cho ${username}-chan! (´;ω;)`);
  }
}

// Perform dance for entertainment
function performDance() {
  try {
    const danceSequence = [
      () => bot.setControlState('left', true),
      () => bot.setControlState('left', false),
      () => bot.setControlState('right', true), 
      () => bot.setControlState('right', false),
      () => bot.setControlState('jump', true),
      () => bot.setControlState('jump', false),
      () => bot.look(bot.entity.yaw + Math.PI, 0),
      () => bot.look(bot.entity.yaw - Math.PI, 0)
    ];
    
    let step = 0;
    const danceInterval = setInterval(() => {
      if (step >= danceSequence.length || currentMode !== 'idle') {
        clearInterval(danceInterval);
        safeChat('Xong rồi! Nhảy hay không? (◕‿◕)♡');
        return;
      }
      
      danceSequence[step]();
      step++;
    }, 500);
    
  } catch (error) {
    console.log('🔧 Lỗi perform dance...');
  }
}

// KHÔNG auto-start bot ở đây - để timeout delay xử lý
