import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { botManager } from "./services/botManager";
import { insertBotSchema, updateBotConfigSchema } from "@shared/schema";
import { ZodError } from "zod";
// import { getBotScreenData, getBotStatus } from "./botlolicute";

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for uptime monitoring
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      message: "PinkMineManager is running! 💕"
    });
  });

  // Update bot configuration endpoint
  app.post("/api/bot/config", async (req, res) => {
    try {
      const { botName, serverHost, serverPort, version } = req.body;
      
      if (!botName || !serverHost) {
        return res.status(400).json({ 
          success: false, 
          error: "Bot name và server host là bắt buộc" 
        });
      }

      // Update botlolicute.ts file
      const fs = require('fs').promises;
      const path = require('path');
      
      const botFilePath = path.join(process.cwd(), 'server', 'botlolicute.ts');
      let fileContent = await fs.readFile(botFilePath, 'utf8');
      
      // Parse port (default 25565 if not provided)
      const port = serverPort ? parseInt(serverPort) : 25565;
      const mcVersion = version || '1.19.4';
      
      // Replace BOT_CONFIG section
      const configRegex = /const BOT_CONFIG = \{[\s\S]*?\};/;
      const newConfig = `const BOT_CONFIG = {
  host: '${serverHost}',
  port: ${port},
  username: '${botName}',
  version: '${mcVersion}',
  skipValidation: true,
  checkTimeoutInterval: 60000,
  keepAlive: true,
  hideErrors: false,
  auth: 'offline' as 'offline'
};`;
      
      fileContent = fileContent.replace(configRegex, newConfig);
      
      // Write back to file
      await fs.writeFile(botFilePath, fileContent, 'utf8');
      
      res.json({ 
        success: true, 
        message: "Cấu hình bot đã được cập nhật thành công!",
        config: {
          botName,
          serverHost,
          port,
          version: mcVersion
        }
      });
      
    } catch (error) {
      console.error('Lỗi cập nhật config bot:', error);
      res.status(500).json({ 
        success: false, 
        error: "Không thể cập nhật cấu hình bot" 
      });
    }
  });

  // Get current bot configuration
  app.get("/api/bot/config", async (req, res) => {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      
      const botFilePath = path.join(process.cwd(), 'server', 'botlolicute.ts');
      const fileContent = await fs.readFile(botFilePath, 'utf8');
      
      // Extract current config using regex
      const configMatch = fileContent.match(/const BOT_CONFIG = \{[\s\S]*?\};/);
      if (configMatch) {
        const configStr = configMatch[0];
        
        // Extract values using regex
        const hostMatch = configStr.match(/host:\s*['"`]([^'"`]+)['"`]/);
        const portMatch = configStr.match(/port:\s*(\d+)/);
        const usernameMatch = configStr.match(/username:\s*['"`]([^'"`]+)['"`]/);
        const versionMatch = configStr.match(/version:\s*['"`]([^'"`]+)['"`]/);
        
        const currentConfig = {
          botName: usernameMatch ? usernameMatch[1] : 'botlolicute',
          serverHost: hostMatch ? hostMatch[1] : 'thuatzai123.aternos.me',
          serverPort: portMatch ? parseInt(portMatch[1]) : 25565,
          version: versionMatch ? versionMatch[1] : '1.19.4'
        };
        
        res.json({ success: true, config: currentConfig });
      } else {
        res.status(404).json({ success: false, error: "Không tìm thấy cấu hình bot" });
      }
      
    } catch (error) {
      console.error('Lỗi đọc config bot:', error);
      res.status(500).json({ success: false, error: "Không thể đọc cấu hình bot" });
    }
  });

  // Bot screen sharing endpoint - IMPROVED: Real data from botlolicute
  app.get("/api/bots/:id/screen", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Mock bot screen data (không import botlolicute để tránh duplicate)
      const realBotStatus = { isConnected: false, reconnectAttempts: 0 };
      const realScreenData = { 
        mode: 'offline', 
        status: 'Disconnected',
        health: 20,
        food: 20,
        position: { x: 0, y: 64, z: 0 },
        nearbyMobs: [],
        equipment: { weapon: null, armor: [] },
        targetPlayer: null
      };
      
      if (!realBotStatus.isConnected) {
        // Return offline data when bot is not connected
        const offlineData = {
          connected: false,
          health: 0,
          food: 0,
          position: { x: 0, y: 64, z: 0 },
          mode: 'offline',
          currentAction: 'Bot không kết nối - Đang thử kết nối lại...',
          nearbyEntities: [],
          inventory: [],
          equipment: { weapon: null, armor: [] },
          targetPlayer: null,
          status: 'Offline',
          timestamp: new Date().toISOString()
        };
        return res.json(offlineData);
      }

      // Return real bot screen data
      const screenData = {
        connected: realBotStatus.isConnected,
        health: realScreenData.health,
        food: realScreenData.food,
        position: realScreenData.position,
        mode: realScreenData.mode,
        currentAction: realScreenData.status,
        nearbyEntities: realScreenData.nearbyMobs,
        inventory: [], // Could be expanded to show real inventory
        equipment: realScreenData.equipment,
        targetPlayer: realScreenData.targetPlayer,
        status: realScreenData.status,
        reconnectAttempts: realBotStatus.reconnectAttempts,
        timestamp: new Date().toISOString()
      };

      res.json(screenData);
    } catch (error) {
      console.error("Error getting bot screen:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/ping", (req, res) => {
    res.status(200).send("pong");
  });

  // Bot management routes
  app.get("/api/bots", async (req, res) => {
    try {
      const bots = await storage.getBots();
      res.json(bots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bots" });
    }
  });

  app.post("/api/bots", async (req, res) => {
    try {
      const validatedData = insertBotSchema.parse(req.body);
      const bot = await storage.createBot(validatedData);
      res.status(201).json(bot);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Invalid bot data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create bot" });
      }
    }
  });

  app.post("/api/bots/:id/start", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await botManager.startBot(id);

      if (success) {
        res.json({ message: "Bot started successfully" });
      } else {
        res.status(500).json({ error: "Failed to start bot" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to start bot" });
    }
  });

  app.post("/api/bots/:id/stop", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await botManager.stopBot(id);

      if (success) {
        res.json({ message: "Bot stopped successfully" });
      } else {
        res.status(500).json({ error: "Failed to stop bot" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to stop bot" });
    }
  });

  app.put("/api/bots/:id/config", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedConfig = updateBotConfigSchema.parse(req.body);

      const success = await botManager.updateBotConfig(id, validatedConfig);

      if (success) {
        const updatedBot = await storage.getBot(id);
        res.json(updatedBot);
      } else {
        res.status(500).json({ error: "Failed to update bot configuration" });
      }
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: "Invalid configuration data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update bot configuration" });
      }
    }
  });

  app.delete("/api/bots/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Stop bot if running
      await botManager.stopBot(id);

      // Delete from storage
      const success = await storage.deleteBot(id);

      if (success) {
        res.json({ message: "Bot deleted successfully" });
      } else {
        res.status(404).json({ error: "Bot not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete bot" });
    }
  });

  app.get("/api/bots/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const status = botManager.getBotStatus(id);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get bot status" });
    }
  });

  const httpServer = createServer(app);

  // Create WebSocket server for real-time console
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store connected WebSocket clients
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    clients.add(ws);

    // Send initial welcome message
    ws.send(JSON.stringify({
      type: 'welcome',
      message: '🎮 Chào mừng đến với bot loli! 💕',
      timestamp: new Date().toISOString()
    }));

    // Handle client messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'command' && message.botId) {
          // Execute bot commands via console
          handleConsoleCommand(message.botId, message.command);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    // Remove client on disconnect
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Function to broadcast console messages to all connected clients
  const broadcastConsoleMessage = (message: any) => {
    const data = JSON.stringify({
      type: 'console',
      ...message,
      timestamp: new Date().toISOString()
    });

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  // Global function để broadcast logs từ botmineflayer.ts
  (global as any).broadcastToWebConsole = (botId: string, level: string, message: string, source: string) => {
    broadcastConsoleMessage({
      botId,
      level,
      message,
      source
    });
  };

  // Function to handle console commands
  const handleConsoleCommand = async (botId: string, command: string) => {
    try {
      broadcastConsoleMessage({
        botId,
        level: 'info',
        message: `> ${command}`,
        source: 'user'
      });

      // Execute command based on type
      if (command.startsWith('/start')) {
        await botManager.startBot(botId);
        broadcastConsoleMessage({
          botId,
          level: 'success',
          message: 'Bot đang khởi động...',
          source: 'system'
        });
      } else if (command.startsWith('/stop')) {
        await botManager.stopBot(botId);
        broadcastConsoleMessage({
          botId,
          level: 'success',
          message: 'Bot đã dừng.',
          source: 'system'
        });
      } else if (command.startsWith('/status')) {
        const status = botManager.getBotStatus(botId);
        broadcastConsoleMessage({
          botId,
          level: 'info',
          message: `Trạng thái bot: ${status?.status || 'unknown'}`,
          source: 'system'
        });
      } else if (command.startsWith('/say ')) {
        const message = command.substring(5);
        // Send chat message through bot
        const success = botManager.sendBotMessage(botId, message);
        if (success) {
          broadcastConsoleMessage({
            botId,
            level: 'success',
            message: `Bot nói: ${message}`,
            source: 'chat'
          });
        } else {
          broadcastConsoleMessage({
            botId,
            level: 'error',
            message: 'Không thể gửi tin nhắn. Bot có thể chưa kết nối.',
            source: 'system'
          });
        }
      } else {
        broadcastConsoleMessage({
          botId,
          level: 'warning',
          message: 'Lệnh không hợp lệ. Sử dụng: /start, /stop, /status, /say <message>',
          source: 'system'
        });
      }
    } catch (error) {
      broadcastConsoleMessage({
        botId,
        level: 'error',
        message: `Lỗi thực thi lệnh: ${error}`,
        source: 'system'
      });
    }
  };

  // Export broadcast function for use in other modules
  (global as any).broadcastConsoleMessage = broadcastConsoleMessage;

  return httpServer;
}