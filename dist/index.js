// server/index.ts
import express3 from "express";

// server/routes.ts
import express from "express";
import { createServer } from "http";

// server/storage.ts
import { drizzle } from "drizzle-orm/node-postgres";

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["active", "paused", "completed", "draft"] }).default("draft"),
  platforms: jsonb("platforms").$type().default([]),
  objectives: jsonb("objectives").$type().default([]),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  dailyBudget: decimal("daily_budget", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  targetAudience: text("target_audience"),
  industry: text("industry"),
  avgTicket: decimal("avg_ticket", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var creatives = pgTable("creatives", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  name: text("name").notNull(),
  type: text("type", { enum: ["image", "video", "text", "carousel"] }).notNull(),
  fileUrl: text("file_url"),
  content: text("content"),
  status: text("status", { enum: ["approved", "pending", "rejected"] }).default("pending"),
  platforms: jsonb("platforms").$type().default([]),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var metrics = pgTable("metrics", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => campaigns.id),
  userId: integer("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  conversions: integer("conversions").default(0),
  cost: decimal("cost", { precision: 10, scale: 2 }).default("0"),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0"),
  leads: integer("leads").default(0),
  createdAt: timestamp("created_at").defaultNow()
});
var whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactNumber: text("contact_number").notNull(),
  contactName: text("contact_name"),
  message: text("message").notNull(),
  direction: text("direction", { enum: ["incoming", "outgoing"] }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isRead: boolean("is_read").default(false)
});
var copies = pgTable("copies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type", { enum: ["headline", "body", "cta", "description"] }).notNull(),
  platform: text("platform"),
  createdAt: timestamp("created_at").defaultNow()
});
var alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  type: text("type", { enum: ["budget", "performance", "approval", "system"] }).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  totalBudget: decimal("total_budget", { precision: 10, scale: 2 }).notNull(),
  spentAmount: decimal("spent_amount", { precision: 10, scale: 2 }).default("0"),
  period: text("period", { enum: ["daily", "weekly", "monthly", "total"] }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertCreativeSchema = createInsertSchema(creatives).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertMetricSchema = createInsertSchema(metrics).omit({
  id: true,
  createdAt: true
});
var insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  timestamp: true
});
var insertCopySchema = createInsertSchema(copies).omit({
  id: true,
  createdAt: true
});
var insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  createdAt: true
});
var insertBudgetSchema = createInsertSchema(budgets).omit({
  id: true,
  createdAt: true
});

// server/storage.ts
import { eq, desc, and } from "drizzle-orm";
import * as bcrypt from "bcrypt";
var pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
var db = drizzle(pool);
var DatabaseStorage = class {
  async getUser(id) {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }
  async getUserByUsername(username) {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }
  async getUserByEmail(email) {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }
  async createUser(user) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const result = await db.insert(users).values({
      ...user,
      password: hashedPassword
    }).returning();
    return result[0];
  }
  async validatePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }
  async getCampaigns(userId) {
    return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt));
  }
  async getCampaign(id, userId) {
    const result = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, userId))).limit(1);
    return result[0];
  }
  async createCampaign(campaign) {
    const result = await db.insert(campaigns).values(campaign).returning();
    return result[0];
  }
  async updateCampaign(id, campaign, userId) {
    const updateData = { ...campaign };
    delete updateData.platforms;
    const result = await db.update(campaigns).set(updateData).where(and(eq(campaigns.id, id), eq(campaigns.userId, userId))).returning();
    return result[0];
  }
  async deleteCampaign(id, userId) {
    const result = await db.delete(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));
    return true;
  }
  async getCreatives(userId, campaignId) {
    let query = db.select().from(creatives).where(eq(creatives.userId, userId));
    if (campaignId) {
      query = db.select().from(creatives).where(and(eq(creatives.userId, userId), eq(creatives.campaignId, campaignId)));
    }
    return query.orderBy(desc(creatives.createdAt));
  }
  async getCreative(id, userId) {
    const result = await db.select().from(creatives).where(and(eq(creatives.id, id), eq(creatives.userId, userId))).limit(1);
    return result[0];
  }
  async createCreative(creative) {
    const result = await db.insert(creatives).values(creative).returning();
    return result[0];
  }
  async updateCreative(id, creative, userId) {
    const updateData = { ...creative };
    delete updateData.platforms;
    const result = await db.update(creatives).set(updateData).where(and(eq(creatives.id, id), eq(creatives.userId, userId))).returning();
    return result[0];
  }
  async deleteCreative(id, userId) {
    const result = await db.delete(creatives).where(and(eq(creatives.id, id), eq(creatives.userId, userId)));
    return true;
  }
  async getMetrics(campaignId, userId) {
    return db.select().from(metrics).where(and(eq(metrics.campaignId, campaignId), eq(metrics.userId, userId))).orderBy(desc(metrics.date));
  }
  async createMetric(metric) {
    const result = await db.insert(metrics).values(metric).returning();
    return result[0];
  }
  async getDashboardMetrics(userId) {
    const userCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, userId));
    return {
      activeCampaigns: userCampaigns.filter((c) => c.status === "active").length,
      totalSpent: userCampaigns.reduce((sum, c) => sum + parseFloat(c.budget || "0"), 0),
      conversions: Math.floor(Math.random() * 100),
      // This would be calculated from metrics
      avgROI: 4.2
      // This would be calculated from metrics
    };
  }
  async getMessages(userId, contactNumber) {
    let query = db.select().from(whatsappMessages).where(eq(whatsappMessages.userId, userId));
    if (contactNumber) {
      query = db.select().from(whatsappMessages).where(and(eq(whatsappMessages.userId, userId), eq(whatsappMessages.contactNumber, contactNumber)));
    }
    return query.orderBy(desc(whatsappMessages.timestamp));
  }
  async createMessage(message) {
    const result = await db.insert(whatsappMessages).values(message).returning();
    return result[0];
  }
  async markMessageAsRead(id, userId) {
    const result = await db.update(whatsappMessages).set({ isRead: true }).where(and(eq(whatsappMessages.id, id), eq(whatsappMessages.userId, userId)));
    return true;
  }
  async getContacts(userId) {
    const messages = await db.select().from(whatsappMessages).where(eq(whatsappMessages.userId, userId)).orderBy(desc(whatsappMessages.timestamp));
    const contactMap = /* @__PURE__ */ new Map();
    messages.forEach((msg) => {
      if (!contactMap.has(msg.contactNumber)) {
        contactMap.set(msg.contactNumber, {
          contactNumber: msg.contactNumber,
          contactName: msg.contactName || msg.contactNumber,
          lastMessage: msg.message,
          timestamp: new Date(msg.timestamp)
        });
      }
    });
    return Array.from(contactMap.values());
  }
  async getCopies(userId, campaignId) {
    let query = db.select().from(copies).where(eq(copies.userId, userId));
    if (campaignId) {
      query = db.select().from(copies).where(and(eq(copies.userId, userId), eq(copies.campaignId, campaignId)));
    }
    return query.orderBy(desc(copies.createdAt));
  }
  async createCopy(copy) {
    const result = await db.insert(copies).values(copy).returning();
    return result[0];
  }
  async deleteCopy(id, userId) {
    const result = await db.delete(copies).where(and(eq(copies.id, id), eq(copies.userId, userId)));
    return true;
  }
  async getAlerts(userId) {
    return db.select().from(alerts).where(eq(alerts.userId, userId)).orderBy(desc(alerts.createdAt));
  }
  async createAlert(alert) {
    const result = await db.insert(alerts).values(alert).returning();
    return result[0];
  }
  async markAlertAsRead(id, userId) {
    const result = await db.update(alerts).set({ isRead: true }).where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
    return true;
  }
  async getBudgets(userId, campaignId) {
    let query = db.select().from(budgets).where(eq(budgets.userId, userId));
    if (campaignId) {
      query = db.select().from(budgets).where(and(eq(budgets.userId, userId), eq(budgets.campaignId, campaignId)));
    }
    return query.orderBy(desc(budgets.createdAt));
  }
  async createBudget(budget) {
    const result = await db.insert(budgets).values(budget).returning();
    return result[0];
  }
  async updateBudget(id, budget, userId) {
    const result = await db.update(budgets).set(budget).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).returning();
    return result[0];
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
var JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
var upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024
    // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  }
});
var authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.sendStatus(401);
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await storage.getUser(decoded.userId);
    if (!user) {
      return res.sendStatus(401);
    }
    req.user = user;
    next();
  } catch (error) {
    return res.sendStatus(403);
  }
};
async function registerRoutes(app2) {
  app2.post("/api/auth/register", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }
      const user = await storage.createUser(userData);
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({
        user: { id: user.id, username: user.username, email: user.email },
        token
      });
    } catch (error) {
      res.status(400).json({ error: "Invalid user data" });
    }
  });
  app2.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const isValidPassword = await storage.validatePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
      res.json({
        user: { id: user.id, username: user.username, email: user.email },
        token
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });
  app2.get("/api/dashboard", authenticateToken, async (req, res) => {
    try {
      const metrics2 = await storage.getDashboardMetrics(req.user.id);
      const campaigns2 = await storage.getCampaigns(req.user.id);
      const alerts2 = await storage.getAlerts(req.user.id);
      res.json({
        metrics: metrics2,
        recentCampaigns: campaigns2.slice(0, 5),
        alertCount: alerts2.filter((a) => !a.isRead).length
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
  });
  app2.get("/api/campaigns", authenticateToken, async (req, res) => {
    try {
      const campaigns2 = await storage.getCampaigns(req.user.id);
      res.json(campaigns2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });
  app2.post("/api/campaigns", authenticateToken, async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      const campaign = await storage.createCampaign(campaignData);
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ error: "Invalid campaign data" });
    }
  });
  app2.get("/api/campaigns/:id", authenticateToken, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(parseInt(req.params.id), req.user.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });
  app2.put("/api/campaigns/:id", authenticateToken, async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(parseInt(req.params.id), campaignData, req.user.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(400).json({ error: "Invalid campaign data" });
    }
  });
  app2.delete("/api/campaigns/:id", authenticateToken, async (req, res) => {
    try {
      const success = await storage.deleteCampaign(parseInt(req.params.id), req.user.id);
      if (!success) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });
  app2.get("/api/creatives", authenticateToken, async (req, res) => {
    try {
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId) : void 0;
      const creatives2 = await storage.getCreatives(req.user.id, campaignId);
      res.json(creatives2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch creatives" });
    }
  });
  app2.post("/api/creatives", authenticateToken, upload.single("file"), async (req, res) => {
    try {
      const creativeData = insertCreativeSchema.parse({
        ...req.body,
        userId: req.user.id,
        campaignId: req.body.campaignId ? parseInt(req.body.campaignId) : null,
        fileUrl: req.file ? `/uploads/${req.file.filename}` : null
      });
      const creative = await storage.createCreative(creativeData);
      res.json(creative);
    } catch (error) {
      res.status(400).json({ error: "Invalid creative data" });
    }
  });
  app2.delete("/api/creatives/:id", authenticateToken, async (req, res) => {
    try {
      const success = await storage.deleteCreative(parseInt(req.params.id), req.user.id);
      if (!success) {
        return res.status(404).json({ error: "Creative not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete creative" });
    }
  });
  app2.get("/api/whatsapp/messages", authenticateToken, async (req, res) => {
    try {
      const contactNumber = req.query.contact;
      const messages = await storage.getMessages(req.user.id, contactNumber);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  app2.post("/api/whatsapp/messages", authenticateToken, async (req, res) => {
    try {
      const messageData = insertWhatsappMessageSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      const message = await storage.createMessage(messageData);
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });
  app2.get("/api/whatsapp/contacts", authenticateToken, async (req, res) => {
    try {
      const contacts = await storage.getContacts(req.user.id);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });
  app2.get("/api/copies", authenticateToken, async (req, res) => {
    try {
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId) : void 0;
      const copies2 = await storage.getCopies(req.user.id, campaignId);
      res.json(copies2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch copies" });
    }
  });
  app2.post("/api/copies", authenticateToken, async (req, res) => {
    try {
      const copyData = insertCopySchema.parse({
        ...req.body,
        userId: req.user.id
      });
      const copy = await storage.createCopy(copyData);
      res.json(copy);
    } catch (error) {
      res.status(400).json({ error: "Invalid copy data" });
    }
  });
  app2.post("/api/copies/generate", authenticateToken, async (req, res) => {
    try {
      const { product, audience, objective, tone } = req.body;
      const generatedCopies = [
        {
          type: "headline",
          content: `\u{1F680} Transforme seu ${product} com nossa solu\xE7\xE3o inovadora!`,
          platform: "facebook"
        },
        {
          type: "cta",
          content: `Clique aqui e descubra como ${audience} est\xE3o revolucionando seus resultados!`,
          platform: "google"
        },
        {
          type: "description",
          content: `Solu\xE7\xE3o perfeita para ${audience} que buscam ${objective}. Com nosso ${product}, voc\xEA alcan\xE7a resultados extraordin\xE1rios.`,
          platform: "instagram"
        }
      ];
      res.json(generatedCopies);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate copies" });
    }
  });
  app2.get("/api/alerts", authenticateToken, async (req, res) => {
    try {
      const alerts2 = await storage.getAlerts(req.user.id);
      res.json(alerts2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });
  app2.put("/api/alerts/:id/read", authenticateToken, async (req, res) => {
    try {
      const success = await storage.markAlertAsRead(parseInt(req.params.id), req.user.id);
      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark alert as read" });
    }
  });
  app2.get("/api/budgets", authenticateToken, async (req, res) => {
    try {
      const campaignId = req.query.campaignId ? parseInt(req.query.campaignId) : void 0;
      const budgets2 = await storage.getBudgets(req.user.id, campaignId);
      res.json(budgets2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch budgets" });
    }
  });
  app2.use("/uploads", express.static("uploads"));
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express2 from "express";
import fs from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
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
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path2.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path2.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
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
      const clientTemplate = path3.resolve(
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
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express2.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express3();
app.use(express3.json());
app.use(express3.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
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
  const port = 5e3;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
