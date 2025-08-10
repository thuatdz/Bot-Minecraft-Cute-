var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bots: () => bots,
  insertBotSchema: () => insertBotSchema,
  insertUserSchema: () => insertUserSchema,
  updateBotConfigSchema: () => updateBotConfigSchema,
  users: () => users
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var bots = pgTable("bots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  server: text("server").notNull(),
  status: text("status").notNull().default("offline"),
  // online, offline, connecting, error
  autoReconnect: boolean("auto_reconnect").notNull().default(true),
  chatEnabled: boolean("chat_enabled").notNull().default(true),
  movementPattern: text("movement_pattern").notNull().default("random"),
  // random, follow, stay, custom
  responseDelay: integer("response_delay").notNull().default(1e3),
  uptime: integer("uptime").notNull().default(0),
  // in seconds
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").default(sql`now()`)
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var insertBotSchema = createInsertSchema(bots).pick({
  username: true,
  server: true,
  autoReconnect: true,
  chatEnabled: true,
  movementPattern: true,
  responseDelay: true
});
var updateBotConfigSchema = createInsertSchema(bots).pick({
  autoReconnect: true,
  chatEnabled: true,
  movementPattern: true,
  responseDelay: true
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
var MemStorage = class {
  users;
  bots;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.bots = /* @__PURE__ */ new Map();
    const defaultBot = {
      id: "default-bot-1",
      username: "botlolicute",
      server: "thuatzai123.aternos.me",
      status: "offline",
      autoReconnect: true,
      chatEnabled: true,
      movementPattern: "random",
      responseDelay: 1e3,
      uptime: 0,
      lastSeen: /* @__PURE__ */ new Date(),
      createdAt: /* @__PURE__ */ new Date()
    };
    this.bots.set(defaultBot.id, defaultBot);
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async getBots() {
    return Array.from(this.bots.values());
  }
  async getBot(id) {
    return this.bots.get(id);
  }
  async createBot(insertBot) {
    const id = randomUUID();
    const bot = {
      ...insertBot,
      id,
      status: "offline",
      autoReconnect: insertBot.autoReconnect ?? true,
      chatEnabled: insertBot.chatEnabled ?? true,
      movementPattern: insertBot.movementPattern ?? "random",
      responseDelay: insertBot.responseDelay ?? 1e3,
      uptime: 0,
      lastSeen: /* @__PURE__ */ new Date(),
      createdAt: /* @__PURE__ */ new Date()
    };
    this.bots.set(id, bot);
    return bot;
  }
  async updateBot(id, updates) {
    const bot = this.bots.get(id);
    if (!bot) return void 0;
    const updatedBot = { ...bot, ...updates };
    this.bots.set(id, updatedBot);
    return updatedBot;
  }
  async updateBotConfig(id, config) {
    const bot = this.bots.get(id);
    if (!bot) return void 0;
    const updatedBot = { ...bot, ...config };
    this.bots.set(id, updatedBot);
    return updatedBot;
  }
  async deleteBot(id) {
    return this.bots.delete(id);
  }
};
var storage = new MemStorage();

// server/routes.ts
import { ZodError } from "zod";
var botManager = {
  async startBot(id) {
    console.log(`Mock: Starting bot ${id}`);
    return true;
  },
  async stopBot(id) {
    console.log(`Mock: Stopping bot ${id}`);
    return true;
  },
  async updateBotConfig(id, config) {
    console.log(`Mock: Updating bot config ${id}`, config);
    return true;
  }
};
async function registerRoutes(app2) {
  app2.get("/health", (req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: process.uptime(),
      message: "PinkMineManager is running! \u{1F495}"
    });
  });
  app2.post("/api/bot/config", async (req, res) => {
    try {
      const { botName, serverHost, serverPort, version } = req.body;
      if (!botName || !serverHost) {
        return res.status(400).json({
          success: false,
          error: "Bot name v\xE0 server host l\xE0 b\u1EAFt bu\u1ED9c"
        });
      }
      const port = serverPort ? parseInt(serverPort) : 25565;
      const mcVersion = version || "1.19.4";
      console.log("Bot config update:", { botName, serverHost, port, mcVersion });
      res.json({
        success: true,
        message: "C\u1EA5u h\xECnh bot \u0111\xE3 \u0111\u01B0\u1EE3c c\u1EADp nh\u1EADt th\xE0nh c\xF4ng!",
        config: {
          botName,
          serverHost,
          port,
          version: mcVersion
        }
      });
    } catch (error) {
      console.error("L\u1ED7i c\u1EADp nh\u1EADt config bot:", error);
      res.status(500).json({
        success: false,
        error: "Kh\xF4ng th\u1EC3 c\u1EADp nh\u1EADt c\u1EA5u h\xECnh bot"
      });
    }
  });
  app2.get("/api/bot/config", async (req, res) => {
    try {
      const currentConfig = {
        botName: "botlolicute",
        serverHost: "thuatzai123.aternos.me",
        serverPort: 38893,
        version: "1.19.4"
      };
      res.json({ success: true, config: currentConfig });
    } catch (error) {
      console.error("L\u1ED7i \u0111\u1ECDc config bot:", error);
      res.status(500).json({ success: false, error: "Kh\xF4ng th\u1EC3 \u0111\u1ECDc c\u1EA5u h\xECnh bot" });
    }
  });
  app2.get("/api/bots/:id/screen", async (req, res) => {
    try {
      const { id } = req.params;
      const realBotStatus = { isConnected: false, reconnectAttempts: 0 };
      const realScreenData = {
        mode: "offline",
        status: "Disconnected",
        health: 20,
        food: 20,
        position: { x: 0, y: 64, z: 0 },
        nearbyMobs: [],
        equipment: { weapon: null, armor: [] },
        targetPlayer: null
      };
      if (!realBotStatus.isConnected) {
        const offlineData = {
          connected: false,
          health: 0,
          food: 0,
          position: { x: 0, y: 64, z: 0 },
          mode: "offline",
          currentAction: "Bot kh\xF4ng k\u1EBFt n\u1ED1i - \u0110ang th\u1EED k\u1EBFt n\u1ED1i l\u1EA1i...",
          nearbyEntities: [],
          inventory: [],
          equipment: { weapon: null, armor: [] },
          targetPlayer: null,
          status: "Offline",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
        return res.json(offlineData);
      }
      const screenData = {
        connected: realBotStatus.isConnected,
        health: realScreenData.health,
        food: realScreenData.food,
        position: realScreenData.position,
        mode: realScreenData.mode,
        currentAction: realScreenData.status,
        nearbyEntities: realScreenData.nearbyMobs,
        inventory: [],
        // Could be expanded to show real inventory
        equipment: realScreenData.equipment,
        targetPlayer: realScreenData.targetPlayer,
        status: realScreenData.status,
        reconnectAttempts: realBotStatus.reconnectAttempts,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      res.json(screenData);
    } catch (error) {
      console.error("Error getting bot screen:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/ping", (req, res) => {
    res.status(200).send("pong");
  });
  app2.get("/api/bots", async (req, res) => {
    try {
      const bots2 = await storage.getBots();
      res.json(bots2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bots" });
    }
  });
  app2.post("/api/bots", async (req, res) => {
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
  app2.post("/api/bots/:id/start", async (req, res) => {
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
  app2.post("/api/bots/:id/stop", async (req, res) => {
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
  app2.put("/api/bots/:id/config", async (req, res) => {
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
  app2.delete("/api/bots/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await botManager.stopBot(id);
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
  app2.get("/api/bots/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const status = botManager.getBotStatus(id);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to get bot status" });
    }
  });
  const httpServer = createServer(app2);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = /* @__PURE__ */ new Set();
  wss.on("connection", (ws2) => {
    console.log("New WebSocket client connected");
    clients.add(ws2);
    ws2.send(JSON.stringify({
      type: "welcome",
      message: "\u{1F3AE} Ch\xE0o m\u1EEBng \u0111\u1EBFn v\u1EDBi bot loli! \u{1F495}",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    }));
    ws2.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === "command" && message.botId) {
          handleConsoleCommand(message.botId, message.command);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
    ws2.on("close", () => {
      console.log("WebSocket client disconnected");
      clients.delete(ws2);
    });
    ws2.on("error", (error) => {
      console.error("WebSocket error:", error);
      clients.delete(ws2);
    });
  });
  const broadcastConsoleMessage = (message) => {
    const data = JSON.stringify({
      type: "console",
      ...message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };
  global.broadcastToWebConsole = (botId, level, message, source) => {
    broadcastConsoleMessage({
      botId,
      level,
      message,
      source
    });
  };
  const handleConsoleCommand = async (botId, command) => {
    try {
      broadcastConsoleMessage({
        botId,
        level: "info",
        message: `> ${command}`,
        source: "user"
      });
      if (command.startsWith("/start")) {
        await botManager.startBot(botId);
        broadcastConsoleMessage({
          botId,
          level: "success",
          message: "Bot \u0111ang kh\u1EDFi \u0111\u1ED9ng...",
          source: "system"
        });
      } else if (command.startsWith("/stop")) {
        await botManager.stopBot(botId);
        broadcastConsoleMessage({
          botId,
          level: "success",
          message: "Bot \u0111\xE3 d\u1EEBng.",
          source: "system"
        });
      } else if (command.startsWith("/status")) {
        const status = botManager.getBotStatus(botId);
        broadcastConsoleMessage({
          botId,
          level: "info",
          message: `Tr\u1EA1ng th\xE1i bot: ${status?.status || "unknown"}`,
          source: "system"
        });
      } else if (command.startsWith("/say ")) {
        const message = command.substring(5);
        const success = botManager.sendBotMessage(botId, message);
        if (success) {
          broadcastConsoleMessage({
            botId,
            level: "success",
            message: `Bot n\xF3i: ${message}`,
            source: "chat"
          });
        } else {
          broadcastConsoleMessage({
            botId,
            level: "error",
            message: "Kh\xF4ng th\u1EC3 g\u1EEDi tin nh\u1EAFn. Bot c\xF3 th\u1EC3 ch\u01B0a k\u1EBFt n\u1ED1i.",
            source: "system"
          });
        }
      } else {
        broadcastConsoleMessage({
          botId,
          level: "warning",
          message: "L\u1EC7nh kh\xF4ng h\u1EE3p l\u1EC7. S\u1EED d\u1EE5ng: /start, /stop, /status, /say <message>",
          source: "system"
        });
      }
    } catch (error) {
      broadcastConsoleMessage({
        botId,
        level: "error",
        message: `L\u1ED7i th\u1EF1c thi l\u1EC7nh: ${error}`,
        source: "system"
      });
    }
  };
  global.broadcastConsoleMessage = broadcastConsoleMessage;
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
process.env.BOT_DISABLED = "true";
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
