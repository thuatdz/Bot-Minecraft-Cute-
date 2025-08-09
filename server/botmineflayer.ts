import mineflayer from 'mineflayer';

export interface BotConfig {
  username: string;
  server: string;
  port: number;
  version: string;
  auth: 'microsoft' | 'mojang' | 'offline';
}

export interface BotStatus {
  connected: boolean;
  health: number;
  food: number;
  uptime: number;
}

export interface BotPosition {
  x: number;
  y: number;
  z: number;
}

export class MinecraftBot {
  private bot: any;
  private config: BotConfig;
  private botId: string;
  private consoleCallback?: (botId: string, level: string, message: string, source: string) => void;
  private startTime: Date;
  private connected: boolean = false;

  constructor(config: BotConfig, botId: string, consoleCallback?: (botId: string, level: string, message: string, source: string) => void) {
    this.config = config;
    this.botId = botId;
    this.consoleCallback = consoleCallback;
    this.startTime = new Date();
  }

  private logToConsole(level: string, message: string, source: string = 'bot') {
    if (this.consoleCallback) {
      this.consoleCallback(this.botId, level, message, source);
    }
    console.log(`[${this.botId}] ${level.toUpperCase()}: ${message}`);
  }

  async connect(): Promise<void> {
    try {
      this.logToConsole('info', `Đang kết nối đến ${this.config.server}:${this.config.port}...`, 'system');
      
      const botOptions: any = {
        host: this.config.server,
        port: this.config.port,
        username: this.config.username,
        version: this.config.version,
        auth: this.config.auth
      };

      // Tạo bot instance
      this.bot = mineflayer.createBot(botOptions);

      // Xử lý sự kiện kết nối thành công
      this.bot.on('spawn', () => {
        this.connected = true;
        this.startTime = new Date();
        const position = this.bot.entity.position;
        this.logToConsole('success', `✅ Bot ${this.config.username} đã tham gia server!`, 'connection');
        this.logToConsole('info', `Phiên bản server: ${this.bot.version}`, 'connection');
        this.logToConsole('info', `Vị trí: ${Math.round(position.x)}, ${Math.round(position.y)}, ${Math.round(position.z)}`, 'connection');
        
        // Gửi tin nhắn chào mừng
        setTimeout(() => {
          this.sendChat('Xin chào! Tôi là bot Mineflayer cute! (◕‿◕)✨');
        }, 2000);
      });

      // Xử lý sự kiện chat
      this.bot.on('chat', (username: string, message: string) => {
        if (username === this.bot.username) return;
        
        this.logToConsole('info', `<${username}> ${message}`, 'chat');
        
        // Phản hồi tự động
        if (message.toLowerCase().includes('ping')) {
          this.sendChat('Pong! ✨');
        } else if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
          this.sendChat(`Hello ${username}! Nice to meet you! (◕‿◕)`);
        } else if (message.toLowerCase().includes('dance')) {
          this.performDance();
        }
      });

      // Xử lý sự kiện ngắt kết nối
      this.bot.on('end', (reason: string) => {
        this.connected = false;
        this.logToConsole('warning', `❌ Bot đã ngắt kết nối. Lý do: ${reason || 'Unknown'}`, 'connection');
      });

      // Xử lý lỗi
      this.bot.on('error', (err: Error) => {
        this.connected = false;
        this.logToConsole('error', `🔴 Lỗi bot: ${err.message}`, 'error');
        
        if (err.message.includes('Invalid username')) {
          this.logToConsole('error', 'Tên bot không hợp lệ!', 'error');
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
          this.logToConsole('error', 'Không thể kết nối đến server. Kiểm tra lại địa chỉ và port!', 'error');
        }
      });

      // Xử lý sự kiện bị kick
      this.bot.on('kicked', (reason: string) => {
        this.connected = false;
        this.logToConsole('warning', `⚠️ Bot bị kick: ${reason}`, 'connection');
      });

      // Xử lý sự kiện đăng nhập
      this.bot.on('login', () => {
        this.logToConsole('info', 'Đang đăng nhập vào server...', 'connection');
      });

      // Xử lý health và food updates
      this.bot.on('health', () => {
        if (this.bot.health < 10) {
          this.logToConsole('warning', `⚠️ Máu thấp: ${this.bot.health}/20`, 'status');
        }
        if (this.bot.food < 10) {
          this.logToConsole('warning', `⚠️ Đói: ${this.bot.food}/20`, 'status');
        }
      });

    } catch (error) {
      this.connected = false;
      this.logToConsole('error', `Lỗi khởi tạo bot: ${error}`, 'error');
      throw error;
    }
  }

  disconnect(): void {
    if (this.bot) {
      this.connected = false;
      this.bot.quit('Bot đã được dừng từ dashboard');
      this.logToConsole('info', '🔌 Bot đã ngắt kết nối', 'connection');
    }
  }

  sendChat(message: string): void {
    if (this.bot && this.connected) {
      this.bot.chat(message);
      this.logToConsole('success', `💬 Đã gửi: "${message}"`, 'chat');
    } else {
      this.logToConsole('error', 'Bot chưa kết nối, không thể gửi chat', 'error');
    }
  }

  getStatus(): BotStatus {
    if (!this.bot || !this.connected) {
      return {
        connected: false,
        health: 0,
        food: 0,
        uptime: 0
      };
    }

    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    
    return {
      connected: this.connected,
      health: this.bot.health || 0,
      food: this.bot.food || 0,
      uptime: uptime
    };
  }

  getPosition(): BotPosition {
    if (!this.bot || !this.connected || !this.bot.entity) {
      return { x: 0, y: 0, z: 0 };
    }

    const pos = this.bot.entity.position;
    return {
      x: Math.round(pos.x * 100) / 100,
      y: Math.round(pos.y * 100) / 100,
      z: Math.round(pos.z * 100) / 100
    };
  }

  // Chức năng nhảy múa cute
  private performDance(): void {
    if (!this.bot || !this.connected) return;

    this.sendChat("Let's dance! ✨(◕‿◕)✨");
    this.logToConsole('info', '💃 Bắt đầu nhảy múa!', 'action');

    let danceStep = 0;
    const danceInterval = setInterval(() => {
      if (!this.bot || !this.connected) {
        clearInterval(danceInterval);
        return;
      }

      switch (danceStep % 4) {
        case 0:
          this.bot.setControlState('forward', true);
          setTimeout(() => this.bot.setControlState('forward', false), 250);
          break;
        case 1:
          this.bot.setControlState('back', true);
          setTimeout(() => this.bot.setControlState('back', false), 250);
          break;
        case 2:
          this.bot.setControlState('left', true);
          setTimeout(() => this.bot.setControlState('left', false), 250);
          break;
        case 3:
          this.bot.setControlState('right', true);
          setTimeout(() => this.bot.setControlState('right', false), 250);
          break;
      }

      // Thêm jump để tạo hiệu ứng nhảy
      if (danceStep % 2 === 0) {
        this.bot.setControlState('jump', true);
        setTimeout(() => this.bot.setControlState('jump', false), 100);
      }

      danceStep++;
      if (danceStep >= 12) {
        clearInterval(danceInterval);
        this.sendChat("Finished dancing! Dou deshita ka? (◕‿◕)✨");
        this.logToConsole('success', '✨ Hoàn thành màn biểu diễn nhảy múa!', 'action');
      }
    }, 500);
  }
}

// Bot manager để quản lý nhiều bot instances
class BotManager {
  private static instance: BotManager;
  private bots: Map<string, MinecraftBot> = new Map();

  static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }
    return BotManager.instance;
  }

  async createBot(botId: string, config: BotConfig, consoleCallback?: (botId: string, level: string, message: string, source: string) => void): Promise<MinecraftBot> {
    const bot = new MinecraftBot(config, botId, consoleCallback);
    this.bots.set(botId, bot);
    await bot.connect();
    return bot;
  }

  getBot(botId: string): MinecraftBot | undefined {
    return this.bots.get(botId);
  }

  removeBot(botId: string): void {
    const bot = this.bots.get(botId);
    if (bot) {
      bot.disconnect();
      this.bots.delete(botId);
    }
  }

  getAllBots(): MinecraftBot[] {
    return Array.from(this.bots.values());
  }

  async connectBotToServer(botId: string, username: string, consoleCallback?: (botId: string, level: string, message: string, source: string) => void): Promise<boolean> {
    try {
      const config: BotConfig = {
        username: username,
        server: 'thuatzai123.aternos.me',
        port: 38893,
        version: '1.19.4',
        auth: 'offline'
      };
      
      const bot = await this.createBot(botId, config, consoleCallback);
      console.log(`🚀 Đã tạo bot ${username} cho server thuatzai123.aternos.me:38893`);
      return true;
    } catch (error) {
      console.error(`❌ Lỗi tạo bot ${username}:`, error);
      return false;
    }
  }
}

// Export instance
export const botManager = BotManager.getInstance();
export default MinecraftBot;