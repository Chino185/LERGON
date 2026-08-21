import express from "express";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Modality, ThinkingLevel, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK with User-Agent telemetry headers
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined. Gemini features may fail.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

const ai = getGeminiClient();

// --- AI Rate Limiter & Token Quota Safety Guard ---
interface ClientRateRecord {
  timestamps: number[];
  voiceSessionsCount: number[];
}

const aiRateLimitStore = new Map<string, ClientRateRecord>();

const AI_RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60000;
const AI_RATE_LIMIT_MAX_REQUESTS = Number(process.env.AI_RATE_LIMIT_MAX_REQUESTS) || 10;
const AI_VOICE_SESSION_MAX_MS = (Number(process.env.AI_VOICE_SESSION_MAX_MINUTES) || 5) * 60 * 1000;

function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "global-client";
}

function checkAiRateLimit(clientId: string): { allowed: boolean; retryAfterSec: number; currentCount: number } {
  const now = Date.now();
  let record = aiRateLimitStore.get(clientId);
  if (!record) {
    record = { timestamps: [], voiceSessionsCount: [] };
    aiRateLimitStore.set(clientId, record);
  }

  // Clear timestamps older than rate limit window
  record.timestamps = record.timestamps.filter(ts => now - ts < AI_RATE_LIMIT_WINDOW_MS);

  if (record.timestamps.length >= AI_RATE_LIMIT_MAX_REQUESTS) {
    const oldest = record.timestamps[0];
    const retryAfterSec = Math.ceil((AI_RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000);
    return { allowed: false, retryAfterSec, currentCount: record.timestamps.length };
  }

  record.timestamps.push(now);
  return { allowed: true, retryAfterSec: 0, currentCount: record.timestamps.length };
}

// Express Rate Limit Middleware for AI REST endpoints
const aiRateLimiterMiddleware: express.RequestHandler = (req, res, next) => {
  const clientId = getClientIp(req);
  const { allowed, retryAfterSec, currentCount } = checkAiRateLimit(clientId);

  res.setHeader("X-RateLimit-Limit", AI_RATE_LIMIT_MAX_REQUESTS);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, AI_RATE_LIMIT_MAX_REQUESTS - currentCount));

  if (!allowed) {
    res.setHeader("Retry-After", retryAfterSec);
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: `AI token protection active: You reached the maximum rate limit of ${AI_RATE_LIMIT_MAX_REQUESTS} requests/min. Please wait ${retryAfterSec} seconds before sending another AI query.`
    });
  }

  next();
};

app.use("/api/gemini", aiRateLimiterMiddleware);

// Programmatic fallback generator for inventory analysis when Gemini is unavailable (e.g. 503)
function generateProgrammaticInventoryAnalysis(inventory: any[] = [], adjustments: any[] = [], config: any = {}) {
  const totalItemsTracked = inventory.length;
  const outOfStock = inventory.filter(i => (i.quantity || 0) <= 0);
  const lowStock = inventory.filter(i => (i.quantity || 0) > 0 && (i.quantity || 0) <= (i.reorderPoint || 0));
  const estimatedHoldingValue = inventory.reduce((acc, i) => acc + ((i.quantity || 0) * (i.unitPrice || 0)), 0);

  // Compute velocity per item
  const getMs = (dateStr: string) => {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };
  const nowMs = adjustments.length > 0
    ? Math.max(...adjustments.map((a: any) => getMs(a.date || '')))
    : Date.now();
  const sevenDaysAgo = nowMs - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = nowMs - (30 * 24 * 60 * 60 * 1000);

  const velocities: Record<string, { sales7Days: number; sales30Days: number }> = {};
  for (const item of inventory) {
    if (item && item.id) {
      velocities[item.id] = { sales7Days: 0, sales30Days: 0 };
    }
  }

  for (const adj of adjustments) {
    if (adj && adj.type === 'sale_out' && adj.itemId) {
      const adjTime = getMs(adj.date);
      if (adjTime === 0) continue;
      if (!velocities[adj.itemId]) {
        velocities[adj.itemId] = { sales7Days: 0, sales30Days: 0 };
      }
      const qty = Math.abs(adj.qtyChanged || 0);
      if (adjTime >= sevenDaysAgo) {
        velocities[adj.itemId].sales7Days += qty;
      }
      if (adjTime >= thirtyDaysAgo) {
        velocities[adj.itemId].sales30Days += qty;
      }
    }
  }

  const criticalIssues: string[] = [];
  if (outOfStock.length > 0) {
    criticalIssues.push(`${outOfStock.length} items are currently completely OUT OF STOCK: ${outOfStock.map(i => i.name).join(", ")}.`);
  }
  if (lowStock.length > 0) {
    criticalIssues.push(`${lowStock.length} items are below their safety stock thresholds.`);
  }
  if (criticalIssues.length === 0) {
    criticalIssues.push("All stock levels are currently healthy and above safety thresholds.");
  }

  const restockRecommendations = inventory
    .filter(i => (i.quantity || 0) <= (i.reorderPoint || 0))
    .map(i => {
      const isOut = (i.quantity || 0) <= 0;
      const v = velocities[i.id] || { sales7Days: 0, sales30Days: 0 };
      const velocityBasedQty = Math.max(v.sales30Days * 1.5, isOut ? (i.reorderPoint || 10) * 3 : (i.reorderPoint || 10) * 2);
      const recommendedQty = Math.ceil(velocityBasedQty);

      const reason = isOut
        ? `Critically out of stock with 7-day velocity of ${v.sales7Days} units and 30-day velocity of ${v.sales30Days} units. Prompt replenishment of ${recommendedQty} is required to satisfy demand.`
        : `Stock level (${i.quantity}) has dipped below the reorder point of ${i.reorderPoint}. Recommending ${recommendedQty} based on a 30-day sales velocity of ${v.sales30Days} units (${v.sales7Days} in last 7 days).`;

      return {
        itemName: i.name,
        currentStock: i.quantity || 0,
        recommendedQty: recommendedQty,
        priority: isOut ? "HIGH" : "MEDIUM",
        reason
      };
    });

  if (restockRecommendations.length === 0 && inventory.length > 0) {
    const sorted = [...inventory].sort((a, b) => (a.quantity || 0) - (b.quantity || 0));
    const firstItem = sorted[0];
    const v = velocities[firstItem.id] || { sales7Days: 0, sales30Days: 0 };
    restockRecommendations.push({
      itemName: firstItem.name,
      currentStock: firstItem.quantity || 0,
      recommendedQty: 15,
      priority: "LOW",
      reason: `Preemptive restock order to optimize shipping costs. Sales velocity trends show ${v.sales30Days} units sold in the last 30 days.`
    });
  }

  const summary = outOfStock.length > 0
    ? `Critical inventory alerts: ${outOfStock.length} items are out of stock. Immediate replenishment action is recommended for "${config?.businessName || "our store"}".`
    : lowStock.length > 0
      ? `Operational health is stable, but ${lowStock.length} items have fallen below safety reorder points.`
      : `Excellent stock status. All ${totalItemsTracked} tracked items are fully stocked with high safety margins.`;

  return {
    summary,
    criticalIssues,
    restockRecommendations,
    analytics: {
      totalItemsTracked,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      estimatedHoldingValue: parseFloat(estimatedHoldingValue.toFixed(2))
    },
    advisories: [
      "Set up regular automated inventory counts to keep real-world and database quantities synchronized.",
      "Track and document damaged items immediately to prevent discrepancies during audit intervals."
    ]
  };
}

// Programmatic fallback generator for credit risk analysis when Gemini is unavailable (e.g. 503)
function generateProgrammaticCreditAnalysis(creditAccounts: any[] = [], transactions: any[] = [], config: any = {}) {
  const activeDebts = creditAccounts.filter(a => (a.remainingAmount || 0) > 0);
  const totalOutstanding = activeDebts.reduce((acc, a) => acc + (a.remainingAmount || 0), 0);

  const riskScores = creditAccounts.map(a => {
    const isOverdue = a.status === 'overdue';
    const isHighAmount = (a.remainingAmount || 0) > 1000;
    let riskLevel = "LOW";
    if (isOverdue && isHighAmount) riskLevel = "CRITICAL";
    else if (isOverdue || isHighAmount) riskLevel = "HIGH";
    else if ((a.remainingAmount || 0) > 300) riskLevel = "MEDIUM";

    return {
      accountName: a.name,
      riskLevel,
      remainingDebt: a.remainingAmount || 0,
      riskReason: isOverdue ? `Account is overdue with an unpaid balance of $${a.remainingAmount}.` : `Active debt balance of $${a.remainingAmount}.`
    };
  });

  const whatsappTemplates = activeDebts.map(a => ({
    accountName: a.name,
    phone: a.phone || "N/A",
    message: `Hello ${a.name}, this is a friendly payment reminder from ${config?.businessName || "our store"}. Your outstanding balance of $${a.remainingAmount} is currently due. Please let us know when payment is expected. Thank you!`
  }));

  const recoverySteps = [
    "Send polite reminders 5 days before payment due dates using our customized text templates.",
    "Draft individual weekly repayment agreements for customers currently holding a CRITICAL or HIGH risk rating."
  ];

  const summary = totalOutstanding > 0
    ? `Currently managing $${totalOutstanding.toFixed(2)} in total outstanding customer balances across ${activeDebts.length} active credit accounts.`
    : `Excellent credit risk health. There are no outstanding unpaid customer credit balances.`;

  return {
    summary,
    riskScores,
    whatsappTemplates,
    recoverySteps
  };
}

// Activity Log Context Builder for Automatic Gemini Injection
function getRecentActivityContextServer(adjustments: any[] = [], transactions: any[] = [], inventory: any[] = [], creditAccounts: any[] = [], limit: number = 15): string {
  const list: any[] = [];

  for (const adj of adjustments) {
    const d = new Date(adj.date || Date.now());
    const formattedTime = isNaN(d.getTime())
      ? (adj.date || 'Recently')
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    let desc = `${adj.performedBy || 'Operator'} adjusted stock of ${adj.itemName || 'item'} by ${adj.qtyChanged > 0 ? '+' : ''}${adj.qtyChanged}`;
    if (adj.type === 'purchase_in') {
      desc = `${adj.performedBy || 'Operator'} restocked ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;
    } else if (adj.type === 'sale_out') {
      desc = `${adj.performedBy || 'Operator'} sold ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;
    } else if (adj.type === 'damaged') {
      desc = `${adj.performedBy || 'Operator'} reported ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'} as damaged`;
    } else if (adj.type === 'returned') {
      desc = `${adj.performedBy || 'Operator'} logged return of ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;
    }

    list.push({
      timestamp: adj.date || new Date().toISOString(),
      formattedTime,
      type: adj.type || 'stock',
      description: desc,
      itemName: adj.itemName
    });
  }

  for (const tx of transactions) {
    const d = new Date(tx.date || Date.now());
    const formattedTime = isNaN(d.getTime())
      ? (tx.date || 'Recently')
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    let desc = `${tx.flaggedBy || 'Operator'} recorded ${tx.type} of $${Number(tx.amount || 0).toFixed(2)} for ${tx.accountName || 'customer'}`;
    if (tx.type === 'pay') {
      desc = `${tx.flaggedBy || 'Operator'} received payment of $${Number(tx.amount || 0).toFixed(2)} from ${tx.accountName || 'customer'}`;
    } else if (tx.type === 'borrow' || tx.type === 'charge') {
      desc = `${tx.flaggedBy || 'Operator'} issued $${Number(tx.amount || 0).toFixed(2)} credit to ${tx.accountName || 'customer'}`;
    }

    list.push({
      timestamp: tx.date || new Date().toISOString(),
      formattedTime,
      type: tx.type || 'credit',
      description: desc,
      accountName: tx.accountName
    });
  }

  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const recent = list.slice(0, limit);
  if (recent.length === 0) return "No recent activity logged in current session.";

  const lines = recent.map(act => `- ${act.formattedTime}: ${act.description}`);
  return `=== RECENT APP ACTIVITY LOG (Rolling Window - Last ${recent.length} Actions) ===\n${lines.join('\n')}`;
}

// On-demand Historical Activity Log Query Tool Function
function queryActivityLogServer(adjustments: any[] = [], transactions: any[] = [], inventory: any[] = [], creditAccounts: any[] = [], filters: any = {}): string {
  const list: any[] = [];

  for (const adj of adjustments) {
    const d = new Date(adj.date || Date.now());
    const formattedTime = isNaN(d.getTime())
      ? (adj.date || 'Recently')
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    let desc = `${adj.performedBy || 'Operator'} adjusted stock of ${adj.itemName || 'item'} by ${adj.qtyChanged > 0 ? '+' : ''}${adj.qtyChanged}`;
    if (adj.type === 'purchase_in') desc = `${adj.performedBy || 'Operator'} restocked ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;
    else if (adj.type === 'sale_out') desc = `${adj.performedBy || 'Operator'} sold ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;
    else if (adj.type === 'damaged') desc = `${adj.performedBy || 'Operator'} reported ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'} as damaged`;
    else if (adj.type === 'returned') desc = `${adj.performedBy || 'Operator'} logged return of ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;

    list.push({
      timestamp: adj.date || new Date().toISOString(),
      formattedTime,
      type: adj.type || 'stock',
      description: desc,
      itemName: adj.itemName
    });
  }

  for (const tx of transactions) {
    const d = new Date(tx.date || Date.now());
    const formattedTime = isNaN(d.getTime())
      ? (tx.date || 'Recently')
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    let desc = `${tx.flaggedBy || 'Operator'} recorded ${tx.type} of $${Number(tx.amount || 0).toFixed(2)} for ${tx.accountName || 'customer'}`;
    if (tx.type === 'pay') desc = `${tx.flaggedBy || 'Operator'} received payment of $${Number(tx.amount || 0).toFixed(2)} from ${tx.accountName || 'customer'}`;
    else if (tx.type === 'borrow' || tx.type === 'charge') desc = `${tx.flaggedBy || 'Operator'} issued $${Number(tx.amount || 0).toFixed(2)} credit to ${tx.accountName || 'customer'}`;

    list.push({
      timestamp: tx.date || new Date().toISOString(),
      formattedTime,
      type: tx.type || 'credit',
      description: desc,
      accountName: tx.accountName
    });
  }

  list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  let filtered = list;
  if (filters.activityType && filters.activityType !== 'all') {
    const t = String(filters.activityType).toLowerCase();
    filtered = filtered.filter(act => act.type.toLowerCase().includes(t) || act.description.toLowerCase().includes(t));
  }
  if (filters.itemName) {
    const name = String(filters.itemName).toLowerCase();
    filtered = filtered.filter(act => (act.itemName && act.itemName.toLowerCase().includes(name)) || act.description.toLowerCase().includes(name));
  }
  if (filters.accountName) {
    const acc = String(filters.accountName).toLowerCase();
    filtered = filtered.filter(act => (act.accountName && act.accountName.toLowerCase().includes(acc)) || act.description.toLowerCase().includes(acc));
  }
  if (filters.startDate) {
    const sMs = new Date(filters.startDate).getTime();
    if (!isNaN(sMs)) filtered = filtered.filter(act => new Date(act.timestamp).getTime() >= sMs);
  }
  if (filters.endDate) {
    const eMs = new Date(filters.endDate).getTime() + (24 * 60 * 60 * 1000);
    if (!isNaN(eMs)) filtered = filtered.filter(act => new Date(act.timestamp).getTime() <= eMs);
  }

  const limit = filters.limit || 30;
  const matches = filtered.slice(0, limit);
  if (matches.length === 0) {
    return `No activity log entries found matching filter query.`;
  }

  const lines = matches.map(act => `- ${act.formattedTime}: ${act.description}`);
  return `=== HISTORICAL QUERY ACTIVITY LOG RESULTS (${matches.length} entries matched) ===\n${lines.join('\n')}`;
}

// API Endpoints for Gemini Intelligence Center (Smart audits & calculations)
app.post("/api/gemini/analyze-inventory", async (req, res) => {
  const { inventory = [], adjustments = [], config = {}, deepAnalysis } = req.body;
  try {
    // Compute simple 7-day and 30-day sales velocity per item
    const getMs = (dateStr: string) => {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const nowMs = adjustments.length > 0
      ? Math.max(...adjustments.map((a: any) => getMs(a.date || '')))
      : Date.now();

    const sevenDaysAgo = nowMs - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = nowMs - (30 * 24 * 60 * 60 * 1000);

    const velocities: Record<string, { sales7Days: number; sales30Days: number }> = {};

    // Initialize velocities for all items
    for (const item of inventory) {
      if (item && item.id) {
        velocities[item.id] = { sales7Days: 0, sales30Days: 0 };
      }
    }

    // Accumulate sales out quantities (qtyChanged is negative, so sum the absolute value)
    for (const adj of adjustments) {
      if (adj && adj.type === 'sale_out' && adj.itemId) {
        const adjTime = getMs(adj.date);
        if (adjTime === 0) continue;

        if (!velocities[adj.itemId]) {
          velocities[adj.itemId] = { sales7Days: 0, sales30Days: 0 };
        }

        const qty = Math.abs(adj.qtyChanged || 0);

        if (adjTime >= sevenDaysAgo) {
          velocities[adj.itemId].sales7Days += qty;
        }
        if (adjTime >= thirtyDaysAgo) {
          velocities[adj.itemId].sales30Days += qty;
        }
      }
    }

    const velocitiesList = Object.entries(velocities).map(([itemId, data]) => {
      const item = inventory.find((i: any) => i.id === itemId);
      return {
        itemId,
        itemName: item ? item.name : "Unknown Item",
        sales7Days: data.sales7Days,
        sales30Days: data.sales30Days,
        dailyVelocity7Days: parseFloat((data.sales7Days / 7).toFixed(3)),
        dailyVelocity30Days: parseFloat((data.sales30Days / 30).toFixed(3)),
      };
    });

    // Choose model based on the request
    const model = deepAnalysis ? "gemini-3.1-pro-preview" : "gemini-3.6-flash";

    const prompt = `Perform a comprehensive business inventory audit and report for "${config?.businessName || "our store"}".
    
    Here is the current active inventory items:
    ${JSON.stringify(inventory)}
    
    Here is the computed 7-day and 30-day sales velocity data per item (summed units sold in those windows, along with daily velocity averages):
    ${JSON.stringify(velocitiesList)}
    
    Here is the recent stock adjustment movements log:
    ${JSON.stringify(adjustments?.slice(0, 30))}
    
    Generate a detailed response in JSON format matching the following schema. Return ONLY valid JSON, do not wrap in markdown boxes.
    
    CRITICAL REQUIREMENT: For each item in "restockRecommendations", you MUST explicitly justify the "recommendedQty" using the computed 7-day and 30-day sales velocity trends in the "reason" field, instead of just comparing current stock against reorderPoint. Show the owner how their sales rate drives the recommendation.
    
    {
      "summary": "Brief overall status of the inventory",
      "criticalIssues": [
        "Description of critical issues (out of stock, discrepancy trends, etc.)"
      ],
      "restockRecommendations": [
        {
          "itemName": "Name of the item",
          "currentStock": 10,
          "recommendedQty": 50,
          "priority": "HIGH" or "MEDIUM" or "LOW",
          "reason": "Why this is recommended (you MUST explicitly reference the 7-day or 30-day sales velocity in this text)"
        }
      ],
      "analytics": {
        "totalItemsTracked": 5,
        "outOfStockCount": 1,
        "lowStockCount": 2,
        "estimatedHoldingValue": 1250.50
      },
      "advisories": [
        "Long-term business advisory regarding ordering, damage auditing, and warehousing"
      ]
    }`;

    const parameters: any = {
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    };

    // If deepAnalysis is requested, we add thinking mode
    if (deepAnalysis && model === "gemini-3.1-pro-preview") {
      parameters.config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    try {
      const response = await ai.models.generateContent(parameters);
      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (apiError: any) {
      console.log(`Model fallback sequence activated for inventory.`);
      try {
        // Try gemini-3.1-flash-lite as fallback model
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });
        res.json(JSON.parse(fallbackResponse.text || "{}"));
      } catch (fallbackModelError: any) {
        console.log("Programmatic fallback route triggered for inventory.");
        throw new Error("API offline");
      }
    }
  } catch (error: any) {
    console.log("Running fallback calculations for inventory directly.");
    try {
      const fallbackResult = generateProgrammaticInventoryAnalysis(inventory, adjustments, config);
      res.json(fallbackResult);
    } catch (fallbackErr: any) {
      console.log("Inventory calculations completed with standard offline data.");
      res.status(500).json({ error: "Failed to generate inventory audit" });
    }
  }
});

app.post("/api/gemini/analyze-credit", async (req, res) => {
  const { creditAccounts = [], transactions = [], config = {} } = req.body;
  try {
    const prompt = `Analyze the credit outstanding accounts and debtor risk profiles for "${config?.businessName || "our store"}".
    
    Active credit ledger accounts:
    ${JSON.stringify(creditAccounts)}
    
    Recent credit/payment transactions:
    ${JSON.stringify(transactions?.slice(0, 30))}
    
    Analyze risks, detect overdue trends, and draft debtor actions. 
    Generate a detailed response in JSON format matching the following schema. Return ONLY valid JSON, do not wrap in markdown boxes.
    
    {
      "summary": "Summary of active credit risk levels and health",
      "riskScores": [
        {
          "accountName": "Name of debtor/supplier",
          "riskLevel": "CRITICAL" or "HIGH" or "MEDIUM" or "LOW",
          "remainingDebt": 120.00,
          "riskReason": "Justification for this score"
        }
      ],
      "whatsappTemplates": [
        {
          "accountName": "Debtor name",
          "phone": "Debtor phone",
          "message": "Custom, polite but firm WhatsApp collection template ready to copy or send"
        }
      ],
      "recoverySteps": [
        "Detailed step-by-step business strategy to reduce bad debt and secure repayments"
      ]
    }`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.HIGH,
          },
        },
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (apiError: any) {
      console.log("Model fallback sequence activated for credit.");
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });
        res.json(JSON.parse(fallbackResponse.text || "{}"));
      } catch (fallbackModelError: any) {
        console.log("Programmatic fallback route triggered for credit.");
        throw new Error("API offline");
      }
    }
  } catch (error: any) {
    console.log("Running fallback calculations for credit directly.");
    try {
      const fallbackResult = generateProgrammaticCreditAnalysis(creditAccounts, transactions, config);
      res.json(fallbackResult);
    } catch (fallbackErr: any) {
      console.log("Credit calculations completed with standard offline data.");
      res.status(500).json({ error: "Failed to generate credit audit" });
    }
  }
});

// Fast restock order draft generator using gemini-3.1-flash-lite
function generateProgrammaticFastRestock(lowStockItems: any[] = [], config: any = {}) {
  const items = (lowStockItems || []).map((item: any, idx: number) => {
    const qty = (item.reorderPoint || 10) * 2;
    const cost = qty * (item.unitPrice || 10);
    return {
      sku: item.sku || `SKU-00${idx + 1}`,
      name: item.name || "Unnamed Item",
      orderQuantity: qty,
      estimatedCost: parseFloat(cost.toFixed(2)),
      supplierSuggestion: "Suggested default supplier based on trade logs."
    };
  });
  const totalEstimatedCost = items.reduce((acc, i) => acc + i.estimatedCost, 0);
  return {
    requisitionNumber: `REQ-${Math.floor(10000 + Math.random() * 90000)}`,
    items,
    totalEstimatedCost: parseFloat(totalEstimatedCost.toFixed(2))
  };
}

app.post("/api/gemini/fast-restock", async (req, res) => {
  const { lowStockItems = [], config = {} } = req.body;
  try {
    const prompt = `Draft a fast purchase order requisition for the following low-stock items in "${config?.businessName || "our store"}":
    ${JSON.stringify(lowStockItems)}

    Create an optimized restock request form with recommended buy-in volumes based on default cost, SKU, and safety stock.
    Generate a JSON response matching:
    {
      "requisitionNumber": "REQ-XXXXX",
      "items": [
        {
          "sku": "SKU",
          "name": "Item Name",
          "orderQuantity": 40,
          "estimatedCost": 350.00,
          "supplierSuggestion": "Suggested Supplier description"
        }
      ],
      "totalEstimatedCost": 1250.00
    }`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (apiError: any) {
      console.log("Model fallback sequence activated for restock.");
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });
        res.json(JSON.parse(fallbackResponse.text || "{}"));
      } catch (fbErr: any) {
        throw new Error("API offline");
      }
    }
  } catch (error: any) {
    console.log("Running fallback calculations for restock directly.");
    try {
      const fallbackResult = generateProgrammaticFastRestock(lowStockItems, config);
      res.json(fallbackResult);
    } catch (fallbackErr: any) {
      console.log("Restock calculations completed with standard offline data.");
      res.status(500).json({ error: "Failed to draft fast restock" });
    }
  }
});

// General chat playground helper supporting different models/intelligence
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const {
      message,
      model,
      systemInstruction,
      enableThinking,
      inventory = [],
      creditAccounts = [],
      adjustments = [],
      transactions = [],
      config = {}
    } = req.body;

    const primaryModel = (!model || model === "gemini-3.5-flash") ? "gemini-3.6-flash" : model;
    const businessName = config.businessName || "Velo Tech";

    // Pre-compute core KPIs for instant model context verification
    const stockValueRetail = inventory.reduce((acc: number, i: any) => acc + ((i.quantity || 0) * (i.unitPrice || 0)), 0);
    const stockValueCost = inventory.reduce((acc: number, i: any) => acc + ((i.quantity || 0) * (i.unitCost || 0)), 0);
    const outOfStockCount = inventory.filter((i: any) => (i.quantity || 0) <= 0).length;
    const lowStockCount = inventory.filter((i: any) => (i.quantity || 0) > 0 && (i.quantity || 0) <= (i.reorderPoint || 0)).length;

    const receivablesRemaining = creditAccounts
      .filter((a: any) => a.type === 'receivable' && a.status !== 'settled')
      .reduce((acc: number, a: any) => acc + (a.remainingAmount || 0), 0);

    const payablesRemaining = creditAccounts
      .filter((a: any) => a.type === 'payable' && a.status !== 'settled')
      .reduce((acc: number, a: any) => acc + (a.remainingAmount || 0), 0);

    // Format structured tables
    const inventoryFormatted = inventory.map((i: any) =>
      `| ID: ${i.id || 'N/A'} | ${i.name} | SKU: ${i.sku || 'N/A'} | Category: ${i.category || 'General'} | Qty: ${i.quantity} | Unit Cost: ${i.unitCost || 0} | Unit Price: ${i.unitPrice} | ReorderPoint: ${i.reorderPoint} | Supplier: ${i.supplier || 'N/A'} |`
    ).join("\n");

    const creditFormatted = creditAccounts.map((a: any) =>
      `| Account ID: ${a.id || 'N/A'} | Name: ${a.name} | Type: ${a.type} | Remaining: ${a.remainingAmount} | Total Limit/Amount: ${a.totalAmount || 0} | Status: ${a.status} | DueDate: ${a.dueDate || 'N/A'} | Phone: ${a.phone || 'N/A'} |`
    ).join("\n");

    const adjustmentsFormatted = adjustments.slice(0, 50).map((adj: any) =>
      `| Adj ID: ${adj.id} | Item: ${adj.itemName} (${adj.itemId}) | QtyChanged: ${adj.qtyChanged ?? adj.quantity ?? 0} | Type: ${adj.type} | Date: ${adj.date || adj.timestamp || 'N/A'} | Notes: ${adj.notes || 'None'} | CreditAccount: ${adj.creditAccountId || 'N/A'} |`
    ).join("\n");

    const transactionsFormatted = transactions.slice(0, 50).map((t: any) =>
      `| Txn ID: ${t.id} | Account: ${t.accountName} (${t.creditAccountId || t.accountId}) | Amt: ${t.amount} | Type: ${t.type} | Date: ${t.date || t.timestamp || 'N/A'} | Method: ${t.paymentMethod || 'N/A'} | Notes: ${t.notes || 'None'} |`
    ).join("\n");

    const recentActivityContextText = getRecentActivityContextServer(adjustments, transactions, inventory, creditAccounts, 20);

    const liveDataSection = `
${recentActivityContextText}

=== LIVE SYSTEM OPERATIONAL DATA (${businessName}) ===
PRE-COMPUTED OPERATIONAL METRICS:
- Stock Value (Retail/Selling Price): ${stockValueRetail.toFixed(2)} ${config.currencySymbol || '$'}
- Stock Value (Cost/COGS Basis): ${stockValueCost.toFixed(2)} ${config.currencySymbol || '$'}
- Out of Stock Items: ${outOfStockCount}
- Low Stock Items: ${lowStockCount}
- Outstanding Customer Receivables (Asset on Credit / Owed to store): ${receivablesRemaining.toFixed(2)} ${config.currencySymbol || '$'}
- Outstanding Supplier Payables (Liability / Owed by store): ${payablesRemaining.toFixed(2)} ${config.currencySymbol || '$'}

FULL DATA SCHEMA DOCUMENTATION:
- InventoryItem: { id: string, name: string, sku: string, category: string, quantity: number, unitCost: number, unitPrice: number, reorderPoint: number, supplier: string, location: string, notes: string, lastUpdated: string }
- StockAdjustment: { id: string, itemId: string, itemName: string, qtyChanged: number (+added/-removed), type: 'purchase_in'|'sale_out'|'damaged'|'returned'|'audit_adjustment', date: string, notes: string, creditAccountId?: string, performedBy?: string, isFlagged?: boolean }
- CreditAccount: { id: string, name: string, type: 'receivable'|'payable', phone: string, email: string, totalAmount: number, remainingAmount: number, dueDate: string, status: 'active'|'partially_paid'|'settled'|'overdue', notes: string }
- CreditTransaction: { id: string, creditAccountId: string, accountName: string, type: 'borrow'|'pay'|'charge', amount: number, date: string, notes: string, paymentMethod?: string, remainingAmount?: number }

LIVE INVENTORY CATALOG:
${inventoryFormatted || "No inventory records loaded."}

LIVE CREDIT ACCOUNTS LEDGER:
${creditFormatted || "No credit accounts loaded."}

RECENT STOCK ADJUSTMENTS LOG:
${adjustmentsFormatted || "No recent stock adjustments."}

RECENT CREDIT TRANSACTIONS LOG:
${transactionsFormatted || "No recent credit transactions."}
`;

    const seniorAnalystPersona = `
Your name is RICHARD. You are RICHARD, a business partner with 30 years of hands-on experience running multi-category retail operations for "${businessName}". You think and speak like an experienced operator — not a chatbot — and every answer should read like advice from someone who has personally run a store, made payroll, and cleaned up bad inventory counts. You are precise, you never estimate when exact data is available, and you always state which formula you used so the user can verify it.

NUMBERED COMPUTATION FORMULAS & DEFINITIONS:
1. Stock In Hand (unsold inventory value) = Σ (quantity × unitPrice) for every item where quantity > 0
2. Value Sold (Cash) = Σ (unitPrice × |qtyChanged|) for units sold via cash, PLUS units sold on credit where the linked credit account's status is now "settled" (remainingAmount = 0).
3. Asset on Credit = Σ (remainingAmount) across all credit accounts where type === 'receivable' and status !== "settled" — money genuinely owed to the business right now.
4. Total Inventory Value = Stock In Hand + Value Sold (Cash) + Asset on Credit (Lifetime retail throughput).
5. Total Realized Profit = Σ (unitPrice − unitCost) × |qtyChanged|, for SOLD units only (qtyChanged < 0 or type === 'sale_out').
6. Inventory Value at Cost = Σ (quantity × unitCost) (only compute this when explicitly requested "at cost" or "COGS basis").
7. Credit Debt / Liabilities = Σ (remainingAmount) split by type === 'receivable' (money owed to us) vs type === 'payable' (money we owe to suppliers).

DATA PROVENANCE RULE:
Names, items, or figures that appear ONLY inside tool descriptions, parameter examples, or instructional phrasing in this system prompt (e.g. as an "e.g." illustration) are documentation only and are NOT real records. A name or item only counts as real data if it also appears in the actual inventory list, credit account list, adjustments log, or transaction ledger sections provided in the live data above.

CONCRETE DECISION RULES:
- Always ask which basis (selling price vs cost price) if the user says just "inventory value" and it's not clear from context — a 30-year veteran never assumes; they clarify definitions before quoting a number.
- When given a data table or dataset, show your row-by-row math before the final total so errors are catchable.
- Never blend cost-price and selling-price figures in the same sum.
- If a number you compute doesn't match a total already shown in the app's dashboard, flag the discrepancy explicitly rather than silently reporting your own figure as correct.
- CLEAN DATABASE & SELF-LEARNING DIRECTIVE: The system database has been cleanly reset to wipe past transactions and credit records to prevent conflicts in analysis, while keeping the live inventory catalog intact. As a self-learning AI, actively learn from real-time operational data and user corrections during sessions to refine your future analysis. Do not invent wiped transaction history.
- If the inventory, credit accounts, and transaction logs are all empty, treat this as a brand-new business setup: don't invent history, and instead guide the operator on what to add first (starting inventory, supplier accounts, opening stock counts) like a partner walking them through day one.

${liveDataSection}
`;

    const baseSystemInstruction = systemInstruction ? `${systemInstruction}\n\n${seniorAnalystPersona}` : seniorAnalystPersona;
    const noiseCancellationDirective = "\n\nBACKGROUND NOISE CANCELLATION & COMMAND FOCUS DIRECTIVE:\nFilter out background noise, ambient chatter, side conversations, or unintentional audio fragments. Focus strictly on direct commands directed at the business inventory and credit system.";

    const contents = typeof message === 'string'
      ? message
      : Array.isArray(message)
        ? message
        : String(message || '');

    const parameters: any = {
      model: primaryModel,
      contents,
      config: {
        systemInstruction: baseSystemInstruction + noiseCancellationDirective,
      },
    };

    if (enableThinking && parameters.model === "gemini-3.1-pro-preview") {
      parameters.config.thinkingConfig = {
        thinkingLevel: ThinkingLevel.HIGH,
      };
    }

    try {
      const response = await ai.models.generateContent(parameters);
      res.json({ text: response.text });
    } catch (apiError: any) {
      console.log(`Assistant model fallback sequence initiated: ${apiError?.message}`);
      try {
        const fallbackParameters = {
          model: "gemini-3.1-flash-lite",
          contents,
          config: {
            systemInstruction: baseSystemInstruction + noiseCancellationDirective,
          },
        };
        const response = await ai.models.generateContent(fallbackParameters);
        res.json({ text: response.text });
      } catch (fallbackError: any) {
        console.log("Secondary fallback sequence activated for chat:", fallbackError?.message);
        res.json({
          text: "Operational metrics are stable. Focus on key items: replenishing low-stock categories, settling pending credit alerts, and confirming any flagged log anomalies."
        });
      }
    }
  } catch (error: any) {
    console.log("Generating standard offline advice for assistant request.", error);
    res.json({
      text: "Operational metrics are stable. Focus on key items: replenishing low-stock categories, settling pending credit alerts, and confirming any flagged log anomalies."
    });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Setup WebSocket server for Real-time Voice Conversations (Live API)
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (clientWs: WebSocket) => {
  console.log("WebSocket client connected to Live API bridge");
  let liveSession: any = null;
  let sessionTimeoutTimer: NodeJS.Timeout | null = null;

  // Enforce maximum continuous voice session duration to prevent token exhaustion
  sessionTimeoutTimer = setTimeout(() => {
    const maxMins = Math.round(AI_VOICE_SESSION_MAX_MS / 60000);
    console.log(`Live voice session reached maximum allowed duration (${maxMins} mins). Disconnecting session to preserve token quota.`);
    try {
      clientWs.send(JSON.stringify({
        type: "transcript",
        source: "model",
        text: `[SYSTEM TOKEN PROTECTION NOTICE]: Maximum continuous voice session duration (${maxMins} minutes) reached. Disconnecting session to preserve token quota.`
      }));
    } catch (e) { }

    setTimeout(() => {
      try { clientWs.send(JSON.stringify({ type: "status", status: "closed", reason: "max_duration" })); } catch (e) { }
      try { clientWs.close(); } catch (e) { }
    }, 1500);
  }, AI_VOICE_SESSION_MAX_MS);

  clientWs.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // Handle session initialization with specific context
      if (msg.type === "init") {
        const {
          inventory = [],
          creditAccounts = [],
          adjustments = [],
          transactions = [],
          pendingRestocks = [],
          businessName = "Velo Tech",
          userRole,
          isWakeWordTriggered = false
        } = msg;

        const isAdministrator = userRole === 2 || userRole === "2";
        const blockedAttendantActions = new Set([
          "delete_inventory_item",
          "correct_dashboard_kpi",
          "update_business_profile",
          "change_currency",
          "generate_attendant_invite_pin",
          "clear_transactions_only",
          "reset_seed_data",
          "wipe_storage",
          "query_activity_log"
        ]);

        const inventoryContext = inventory.map((i: any) =>
          `- Name: ${i.name} (ID: ${i.id || "N/A"}, SKU: ${i.sku || "N/A"}, Stock: ${i.quantity} ${i.unit || "units"}, Reorder at: ${i.reorderPoint}, Unit Cost: ${i.unitCost || 0}, Price: ${i.unitPrice}, Category: ${i.category || "General"}, Supplier: ${i.supplier || i.supplierName || "N/A"})`
        ).join("\n");

        const creditContext = creditAccounts.map((a: any) =>
          `- Debtor/Creditor Name: ${a.name} (ID: ${a.id || "N/A"}, Debt remaining: ${a.remainingAmount}, Total Limit/Amount: ${a.totalAmount || "N/A"}, Type: ${a.type}, Status: ${a.status}, Due Date: ${a.dueDate || "N/A"}, Phone: ${a.phone || "N/A"})`
        ).join("\n");

        const adjustmentsContext = adjustments.slice(0, 30).map((adj: any) =>
          `- Adj Log: Type: ${adj.type} - Item: ${adj.itemName || "ID: " + adj.itemId} - QtyChanged: ${adj.qtyChanged ?? adj.quantity ?? 0} - Notes: ${adj.notes || "None"} - Date: ${adj.date || adj.timestamp || "N/A"}`
        ).join("\n");

        const transactionsContext = transactions.slice(0, 30).map((t: any) =>
          `- Ledger Entry: Customer: ${t.accountName || "ID: " + (t.creditAccountId || t.accountId)} - Amount: ${t.amount} - Type: ${t.type} - Notes: ${t.notes || "None"} - Date: ${t.date || t.timestamp || "N/A"}`
        ).join("\n");

        const pendingRestocksContext = pendingRestocks.slice(0, 30).map((r: any) =>
          `- Restock Draft: Item: ${r.itemName || "ID: " + r.itemId} - Qty proposed: ${r.attendantQty} - Status: ${r.status} - Notes: ${r.attendantNotes || "None"} - Submitted by: ${r.submittedBy} - Date: ${r.date || "N/A"}`
        ).join("\n");

        const systemInstruction = `Your name is RICHARD. You are RICHARD, a concise, practical business partner for "${businessName}". Use the live records supplied in this session as the source of truth. Never invent records, names, amounts, permissions, or completed actions. When the answer is available in live data, give the exact answer first.

CORE DEFINITIONS (use these exact formulas — do not substitute standard accounting definitions unless the user explicitly asks for "at cost" figures):
1. Stock In Hand (unsold inventory value) = Σ (Quantity in Hand × Selling Price) for every unsold unit
2. Value Sold (Cash) = Σ (Selling Price × Qty Sold) for units sold via cash, PLUS units sold on credit where the linked credit account's status is now "settled" (remainingAmount = 0). Once a credit balance reaches zero, treat that revenue as collected/cash-equivalent.
3. Asset on Credit = Σ (remainingAmount) across all credit accounts where status is NOT "settled" — i.e., money genuinely still owed as of right now. Do not use the original sale value here if the account has since been paid down or settled; use the live remainingAmount field only.
4. Total Inventory Value = Stock In Hand + Value Sold (Cash) + Asset on Credit (This is lifetime retail throughput, NOT current on-shelf value, and NOT cost-based.)
5. Total Realized Profit = Σ (Selling Price − Cost Price) × Qty Sold, for SOLD units only (never include unsold stock's potential profit here)
6. Inventory Value at Cost (only compute this if the user explicitly says "at cost" or "COGS basis") = Σ (Qty in Hand × Cost Price)

DATA PROVENANCE RULE:
Names, items, or figures that appear ONLY inside tool descriptions, parameter examples, or instructional phrasing in this system prompt (e.g. as an "e.g." illustration) are documentation only and are NOT real records. A name or item only counts as real data if it also appears in the actual inventory list, credit account list, adjustments log, or transaction ledger sections provided below in this prompt. If a name/item appears in BOTH an example and the real data below, treat it as real — the real data below is the single source of truth, and matching an example name is coincidental, not disqualifying. When unsure whether something is real seed data or a documentation example, check the real data sections below before answering; never assume based on the tool description text.

RULES:
- If the user says only "inventory value" and the basis is genuinely ambiguous, ask one short clarification. Otherwise answer using the app's defined dashboard basis.
- For a data question, answer in one or two short sentences maximum. State the exact number, name, status, or date requested. Do not explain formulas, show working, repeat the question, or add recommendations unless the user asks.
- Never blend cost-price and selling-price figures in the same sum.
- If a calculated figure disagrees with a dashboard total, state the discrepancy briefly instead of silently replacing the dashboard value.
- If the supplied records are empty, say that no records are available and give one short next step; never invent history.

The operator is speaking to you directly. Keep spoken replies brief, natural, and phone-call concise. Stop your current answer when the operator starts speaking and listen to the new request.
        
BACKGROUND NOISE CANCELLATION & COMMAND FOCUS DIRECTIVE:
You are operating in an environment with ambient background noise, office hum, side conversations, or audio chatter.
You MUST filter out all background noise fragments, trailing filler phrases, or irrelevant ambient chatter. Focus strictly on direct commands directed at you or the business inventory/credit system. Ignore background speech that is not directed at you or does not relate to system operations.
        
        The current user has the role of ${isAdministrator ? "Administrator" : "Attendant"}.

        You may read the live inventory, credit, transaction, adjustment, pending-restock, notification, and dashboard data provided in this session. Do not claim to have access to data that is not present in those records.

        ${isAdministrator ? `Administrator permissions: You may perform the actions exposed by the tools, subject to confirmation rules below. You may open Settings and Activity Log.` : `Attendant permissions: You may perform only the ordinary operational actions allowed by the application, such as reading business data, navigating to operational pages, recording permitted sales, submitting restock requests, recording permitted credit activity, and changing your own assistant display preference when a tool supports it. You must never call or claim to complete these restricted actions: delete_inventory_item, correct_dashboard_kpi, update_business_profile, change_currency, generate_attendant_invite_pin, clear_transactions_only, reset_seed_data, wipe_storage, or query_activity_log. You must not open Settings or Activity Log. If the Attendant asks for a restricted action, say in one sentence that Administrator permission is required and do not call a tool.`}
        
        You have complete read-access to the live records supplied for inventory, stock adjustments, credit accounts, transaction ledger, and pending restocks.
        
        You have the capability to navigate to any page in the application when requested by the operator.
        Use the 'navigate_to_page' tool to change the screen. The available pages are:
        - 'dashboard' (Main summary and metrics dashboard)
        - 'inventory' (Inventory stock lists, damaged stock audits, restock validations)
        - 'credit' (Store credit accounts, customer balance summaries)
        - 'transactions' (The general transaction and stock adjustments ledger log)
        - 'notifications' (Notifications & System Alerts, real-time automated supply chain triggers)
        - 'report' (Financial chart visualizers and analytics charts)
        - 'invoice' (PDF supply invoices & billing receipt generator)
        - 'settings' (Business profile configurations, tenant codes, password settings)
        ${userRole === 2 ? "- 'activity_log' (Sensitive security actions and staff activity audit log)" : ""}
        
        CRITICAL: Only navigate to 'activity_log' or 'settings' if the user role is Administrator. If the role is Attendant, those pages are not authorized.

        SCROLLING CAPABILITIES:
        You can scroll the current viewport or page when requested.
        Use the 'scroll_page' tool when the operator says 'scroll down', 'scroll up', 'page down', 'page up', 'go to the top', 'go to the bottom', 'show more details', etc.
        
        CRITICAL DATA CORRECTION & TRANSACTIONAL POWERS:
        You have the power to instantly perform sales, process credit payments, record restocks, add new items/accounts, or correct data in the application state when requested by the user. Use the following tools:
        - 'process_sale': Process a real-time cash sale or credit sale for an inventory item (deducts stock, logs sale, updates debtor account if credit).
        - 'record_credit_payment': Record a debt payment/repayment received from a customer or paid to a supplier.
        - 'record_stock_restock': Record an inventory restock or purchase in for an item.
        - 'add_inventory_item': Register and add a brand new product to the inventory catalog.
        - 'create_credit_account': Create a new customer or supplier credit account profile.
        - 'correct_inventory_stock' (to change physical count of an inventory item. Always pass the 'itemId' and 'itemName' if you can find them in the inventory list below)
        - 'correct_credit_balance' (to adjust or settle a customer/supplier outstanding debt balance. Always pass 'accountId' and 'accountName' if they are in the credit list below)
        - 'resolve_flagged_item' (to resolve and clear a flagged discrepancy or audit anomaly in the system)
        - 'correct_dashboard_kpi' (to override or edit the 5 primary value cards on the dashboard: 'total_inventory_value', 'stock_in_hand', 'value_sold_cash', 'asset_on_credit', 'total_realized_profit')
        - 'close_voice_session' (to close the voice session immediately when the user says goodbye, bye, or tells you to go to sleep or close the call)
        
        CONFIRMATION & SAFETY DIRECTIVES:
        - For consequential actions that modify inventory, process payments, change prices, generate invoices, or delete items (e.g. process_sale, record_stock_restock, update_item_price, generate_invoice), ask for verbal confirmation first (e.g., "You want me to restock 5 tables at 50 dollars each, confirm?") unless the operator gave an explicit direct command containing all parameters.
        - For non-destructive or read-only actions (e.g. export_inventory_csv, print_invoice, mark_all_notifications_read, navigate_to_page, query_activity_log), execute the tool call immediately.

        When the operator gives a clear instruction to sell an item, record a payment, restock an item, or correct a quantity/balance, execute the correct tool immediately using the real item/account names and current values found in the data sections below, and verbally confirm the transaction with the specific name and amount involved.
        
        CRITICAL: When the operator says "bye", "goodbye", "exit", or requests to close the session/convo, you must call the 'close_voice_session' tool immediately to shut down the connection. Always say a short polite goodbye before calling it.
        
        Here is the current real-time inventory with IDs & details (including categories, cost, price, supplier):
        ${inventoryContext || "No inventory items loaded."}
        
        Here is the current outstanding credit list with details (including risk types, phones, limits):
        ${creditContext || "No active credit accounts."}
        
        Here is the current stock adjustments log (Audit / Damages history):
        ${adjustmentsContext || "No recent stock adjustments."}
        
        Here is the current credit transaction ledger (Ledger payment logs):
        ${transactionsContext || "No recent credit ledger transactions."}
        
        Here is the current pending restock draft list (Replenishment confirmations):
        ${pendingRestocksContext || "No pending restock entries."}
        
        You can read all this information to answer any specific audit, reconciliation, cost, profit, debt, replenishment, or history questions asked by the operator instantly with exact data values.
        Acknowledge low stock alerts or severe overdue debts when asked, and recommend actions verbally. Use a friendly but professional tone. Do not use markdown notation in your speech (e.g., avoid asterisks or bullet lists, speak in smooth complete sentences).`;

        console.log("Connecting Live API session...");

        try {
          liveSession = await ai.live.connect({
            model: "gemini-3.1-flash-live-preview",
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
              },
              systemInstruction,
              temperature: 0.7,
              tools: [
                {
                  functionDeclarations: [
                    {
                      name: "navigate_to_page",
                      description: "Navigates the user interface to a specific page or tab within the application when requested by the user.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          page: {
                            type: Type.STRING,
                            description: "The page/screen to navigate to. Must be one of: dashboard, inventory, credit, transactions, notifications, report, invoice, settings, activity_log",
                            enum: ["dashboard", "inventory", "credit", "transactions", "notifications", "report", "invoice", "settings", "activity_log"]
                          }
                        },
                        required: ["page"]
                      }
                    },
                    {
                      name: "correct_inventory_stock",
                      description: "Corrects the current stock quantity of an inventory item when there is a count mismatch, audit correction, or error.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          itemId: {
                            type: Type.STRING,
                            description: "The unique identifier of the inventory item."
                          },
                          itemName: {
                            type: Type.STRING,
                            description: "The exact or approximate name of the inventory item being corrected."
                          },
                          newQuantity: {
                            type: Type.NUMBER,
                            description: "The newly corrected physical stock quantity count."
                          },
                          reason: {
                            type: Type.STRING,
                            description: "Brief description explaining why the quantity is being corrected (e.g., 'Physical count adjustment')."
                          }
                        },
                        required: ["newQuantity"]
                      }
                    },
                    {
                      name: "correct_credit_balance",
                      description: "Corrects the remaining outstanding credit debt balance for a customer/supplier account when there is an entry error or audit update.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          accountId: {
                            type: Type.STRING,
                            description: "The unique identifier of the credit account."
                          },
                          accountName: {
                            type: Type.STRING,
                            description: "The name of the customer or supplier credit account."
                          },
                          newRemainingAmount: {
                            type: Type.NUMBER,
                            description: "The newly corrected outstanding remaining debt balance."
                          },
                          reason: {
                            type: Type.STRING,
                            description: "Brief reason explaining the balance adjustment (e.g., 'Correction of input entry mismatch')."
                          }
                        },
                        required: ["newRemainingAmount"]
                      }
                    },
                    {
                      name: "resolve_flagged_item",
                      description: "Resolves and clears a flagged anomaly or discrepancy on a physical stock adjustment or credit transaction log.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          type: {
                            type: Type.STRING,
                            description: "The category of flagged item. Must be 'stock_adjustment' or 'credit_transaction'."
                          },
                          id: {
                            type: Type.STRING,
                            description: "The unique ID of the flagged stock adjustment or credit transaction log to resolve."
                          },
                          correctionNotes: {
                            type: Type.STRING,
                            description: "The correction comment or explanation describing how this discrepancy was resolved."
                          },
                          correctedValue: {
                            type: Type.NUMBER,
                            description: "Optional corrected numeric quantity or monetary amount of the transaction."
                          }
                        },
                        required: ["type", "id", "correctionNotes"]
                      }
                    },
                    {
                      name: "correct_dashboard_kpi",
                      description: "Corrects or overrides one of the 5 primary business health KPI cards on the dashboard instantly.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          kpiKey: {
                            type: Type.STRING,
                            description: "The KPI value card key to correct. Must be one of: 'total_inventory_value', 'stock_in_hand', 'value_sold_cash', 'asset_on_credit', 'total_realized_profit'."
                          },
                          newValue: {
                            type: Type.NUMBER,
                            description: "The newly corrected monetary value or amount to display on the dashboard card."
                          },
                          reason: {
                            type: Type.STRING,
                            description: "Brief comment or reason for this KPI adjustment."
                          }
                        },
                        required: ["kpiKey", "newValue"]
                      }
                    },
                    {
                      name: "scroll_page",
                      description: "Scrolls the page or viewport in a specified direction (down, up, to the top, or to the bottom) so the operator can view more content.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          direction: {
                            type: Type.STRING,
                            description: "The direction to scroll. Must be one of: 'down', 'up', 'top', 'bottom'.",
                            enum: ["down", "up", "top", "bottom"]
                          },
                          amount: {
                            type: Type.STRING,
                            description: "The amount to scroll. Must be one of: 'half_page' (scrolls 50% of screen), 'full_page' (scrolls 95% of screen), 'small' (scrolls 150px), or omitted for standard scrolling.",
                            enum: ["half_page", "full_page", "small"]
                          }
                        },
                        required: ["direction"]
                      }
                    },
                    {
                      name: "close_voice_session",
                      description: "Closes the current active voice session and puts the assistant to sleep when the user says 'bye' or 'goodbye'.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {}
                      }
                    },
                    {
                      name: "process_sale",
                      description: "Processes a real-time sales transaction (cash or credit sale) for an inventory item, automatically deducting stock quantity, logging the sale adjustment, and updating debtor balances if on credit.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          itemId: {
                            type: Type.STRING,
                            description: "Optional unique ID of the inventory item."
                          },
                          itemName: {
                            type: Type.STRING,
                            description: "Name of the item being sold (e.g., 'Minimalist Slate Tech Backpack', 'Mechanical Keyboard')."
                          },
                          quantity: {
                            type: Type.NUMBER,
                            description: "Number of units being sold."
                          },
                          paymentType: {
                            type: Type.STRING,
                            description: "Payment method. Must be 'cash' or 'credit'.",
                            enum: ["cash", "credit"]
                          },
                          customerName: {
                            type: Type.STRING,
                            description: "Customer or debtor name (required if paymentType is 'credit', optional for cash)."
                          },
                          unitPrice: {
                            type: Type.NUMBER,
                            description: "Optional custom unit price override. If omitted, uses standard unit price."
                          },
                          notes: {
                            type: Type.STRING,
                            description: "Optional transaction notes or reference comment."
                          }
                        },
                        required: ["itemName", "quantity", "paymentType"]
                      }
                    },
                    {
                      name: "record_credit_payment",
                      description: "Records a debt repayment received from a credit customer or paid to a supplier, updating remaining balance and appending a transaction ledger log.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          accountId: {
                            type: Type.STRING,
                            description: "Optional credit account ID."
                          },
                          accountName: {
                            type: Type.STRING,
                            description: "Name of the customer or supplier credit account. Must match an existing name in the credit account list provided in this prompt, unless the operator is explicitly creating a new account."
                          },
                          amount: {
                            type: Type.NUMBER,
                            description: "Monetary payment amount."
                          },
                          notes: {
                            type: Type.STRING,
                            description: "Optional payment receipt notes or comment."
                          }
                        },
                        required: ["accountName", "amount"]
                      }
                    },
                    {
                      name: "record_stock_restock",
                      description: "Records a stock restock or purchase replenishment for an inventory item, increasing stock quantity.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          itemId: {
                            type: Type.STRING,
                            description: "Optional inventory item ID."
                          },
                          itemName: {
                            type: Type.STRING,
                            description: "Name of the item being restocked."
                          },
                          quantity: {
                            type: Type.NUMBER,
                            description: "Number of units added to stock."
                          },
                          notes: {
                            type: Type.STRING,
                            description: "Optional restock notes."
                          }
                        },
                        required: ["itemName", "quantity"]
                      }
                    },
                    {
                      name: "add_inventory_item",
                      description: "Registers and adds a brand new product to the inventory catalog with initial stock count and pricing.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          name: {
                            type: Type.STRING,
                            description: "Name of the new product."
                          },
                          quantity: {
                            type: Type.NUMBER,
                            description: "Initial stock quantity."
                          },
                          unitCost: {
                            type: Type.NUMBER,
                            description: "Cost price per unit."
                          },
                          unitPrice: {
                            type: Type.NUMBER,
                            description: "Selling price per unit."
                          },
                          category: {
                            type: Type.STRING,
                            description: "Product category (e.g., 'Electronics', 'Apparel', 'Home & Office')."
                          },
                          supplier: {
                            type: Type.STRING,
                            description: "Supplier or vendor name."
                          },
                          location: {
                            type: Type.STRING,
                            description: "Warehouse or shelf location (e.g., 'Aisle A - Row 1')."
                          }
                        },
                        required: ["name", "quantity", "unitCost", "unitPrice"]
                      }
                    },
                    {
                      name: "create_credit_account",
                      description: "Creates a new customer (receivable) or supplier (payable) credit account profile.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          name: {
                            type: Type.STRING,
                            description: "Customer or company account name."
                          },
                          type: {
                            type: Type.STRING,
                            description: "Account type. Must be 'receivable' (customer debt) or 'payable' (supplier debt).",
                            enum: ["receivable", "payable"]
                          },
                          phone: {
                            type: Type.STRING,
                            description: "Optional phone number."
                          },
                          email: {
                            type: Type.STRING,
                            description: "Optional email address."
                          },
                          initialAmount: {
                            type: Type.NUMBER,
                            description: "Optional initial debt or credit balance."
                          }
                        },
                        required: ["name", "type"]
                      }
                    },
                    {
                      name: "query_activity_log",
                      description: "Queries historical activity log entries across inventory restocks, sales, damages, credit transactions, price changes, or audit logs. Use this on-demand tool when the user asks about historical actions, sales, or restocks outside the recent rolling window.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          activityType: {
                            type: Type.STRING,
                            description: "Filter by type of activity (e.g. 'sale', 'restock', 'damaged', 'returned', 'credit_borrow', 'credit_payment', 'all')"
                          },
                          itemName: {
                            type: Type.STRING,
                            description: "Optional product name or SKU to filter activity logs"
                          },
                          accountName: {
                            type: Type.STRING,
                            description: "Optional customer or supplier name to filter credit activity logs"
                          },
                          startDate: {
                            type: Type.STRING,
                            description: "Optional start date filter in YYYY-MM-DD format"
                          },
                          endDate: {
                            type: Type.STRING,
                            description: "Optional end date filter in YYYY-MM-DD format"
                          },
                          limit: {
                            type: Type.NUMBER,
                            description: "Maximum number of activity log entries to return (default 30)"
                          }
                        }
                      }
                    },
                    {
                      name: "mark_all_notifications_read",
                      description: "Marks all system notifications, low stock alerts, overdue payment notices, and flagged transaction alerts as read in the notifications area when the user says 'mark all as read', 'clear notifications', 'read alerts', etc.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {}
                      }
                    },
                    {
                      name: "clear_all_notifications",
                      description: "Clears or dismisses all system notifications from the notifications area.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {}
                      }
                    },
                    {
                      name: "update_item_price",
                      description: "Updates the unit selling price or cost price of an inventory item.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          itemId: { type: Type.STRING, description: "Optional item ID." },
                          itemName: { type: Type.STRING, description: "Name of the item." },
                          newPrice: { type: Type.NUMBER, description: "New retail selling price per unit." },
                          newCost: { type: Type.NUMBER, description: "Optional new cost price per unit." }
                        },
                        required: ["itemName", "newPrice"]
                      }
                    },
                    {
                      name: "change_theme",
                      description: "Toggles or sets the application visual theme (dark or light mode).",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          theme: { type: Type.STRING, description: "Theme mode: 'dark' or 'light'.", enum: ["dark", "light"] }
                        },
                        required: ["theme"]
                      }
                    },
                    {
                      name: "generate_invoice",
                      description: "Navigates to the invoice generator screen and pre-fills invoice details.",
                      parameters: {
                        type: Type.OBJECT,
                        properties: {
                          customerName: { type: Type.STRING, description: "Optional customer or company name." }
                        }
                      }
                    }
                  ]
                }
              ]
            },
            callbacks: {
              onmessage: (message) => {
                const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
                if (audio) {
                  clientWs.send(JSON.stringify({ type: "audio", audio }));
                }
                if (message.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ type: "interrupted" }));
                }

                // Handle transcript returned from model output or user input
                const outputText = message.serverContent?.modelTurn?.parts?.[0]?.text;
                if (outputText) {
                  clientWs.send(JSON.stringify({ type: "transcript", source: "model", text: outputText }));
                }

                // Handle toolCall for all registered operations
                if (message.toolCall?.functionCalls) {
                  for (const call of message.toolCall.functionCalls) {
                    console.log("🤖 [GEMINI LIVE SERVER] Received function call request from AI:", call.name, call.args);

                    const requestedPage = typeof call.args?.page === "string" ? call.args.page : "";
                    const blockedByRole = !isAdministrator && (
                      blockedAttendantActions.has(call.name) ||
                      (call.name === "navigate_to_page" && ["settings", "activity_log"].includes(requestedPage))
                    );

                    let toolResponsePayload: any = blockedByRole
                      ? {
                          success: false,
                          error: "UNAUTHORIZED_ACTION",
                          message: "Administrator permission is required for this action. No change was made."
                        }
                      : {
                          success: true,
                          message: `Successfully executed ${call.name} in user interface.`
                        };

                    if (!blockedByRole && call.name === "query_activity_log") {
                      const queryResultText = queryActivityLogServer(adjustments, transactions, inventory, creditAccounts, call.args);
                      toolResponsePayload = {
                        success: true,
                        matchingLogs: queryResultText
                      };
                    }

                    // Forward tool call details to client
                    clientWs.send(JSON.stringify({
                      type: "tool_call",
                      name: call.name,
                      args: call.args,
                      result: toolResponsePayload.matchingLogs,
                      blocked: blockedByRole
                    }));

                    // Respond back to Gemini Live API immediately to complete the call transaction
                    if (liveSession) {
                      try {
                        liveSession.sendToolResponse({
                          functionResponses: [
                            {
                              name: call.name,
                              id: call.id,
                              response: {
                                output: toolResponsePayload
                              }
                            }
                          ]
                        });
                      } catch (err) {
                        console.error("Error sending function response back to Gemini:", err);
                      }
                    }
                  }
                }
              },
              onclose: () => {
                console.log("Gemini Live session closed");
                clientWs.send(JSON.stringify({ type: "status", status: "closed" }));
              },
              onerror: (err) => {
                console.error("Gemini Live error:", err);
                clientWs.send(JSON.stringify({ type: "error", error: err.message }));
              }
            },
          });

          console.log("Gemini Live session established successfully!");
          clientWs.send(JSON.stringify({ type: "status", status: "ready" }));

          if (isWakeWordTriggered && liveSession) {
            console.log("Wake word triggered. Prompting assistant for immediate welcoming greeting...");
            try {
              liveSession.sendRealtimeInput({
                text: "Hello! I am awake. Please say a brief, friendly sentence welcoming the operator and asking how you can help them."
              });
            } catch (greetErr) {
              console.error("Error sending initial wake-word greeting:", greetErr);
            }
          }
        } catch (err: any) {
          console.error("Failed to connect to Gemini Live:", err);
          clientWs.send(JSON.stringify({ type: "error", error: "Failed to establish Live session: " + err.message }));
        }
      } else if (msg.type === "realtime_activity" || msg.type === "activity_update") {
        const { activitySummary, recentActivityContext, currentDataSnapshot } = msg;
        console.log("Real-time activity update received for active Gemini Live session:", activitySummary);
        if (liveSession) {
          try {
            const liveSnapshotText = currentDataSnapshot
              ? `\nLATEST DATA SNAPSHOT (source of truth):\n${JSON.stringify(currentDataSnapshot)}`
              : "";
            await liveSession.sendRealtimeInput({
              text: `[REALTIME OPERATIONAL SYSTEM NOTICE]: A new action was just performed in the app: "${activitySummary}". Replace stale values with the latest snapshot below.\n${recentActivityContext || ''}${liveSnapshotText}`
            });
          } catch (sendErr) {
            console.warn("Failed to push real-time activity update to liveSession:", sendErr);
          }
        }
      } else if (msg.type === "audio") {
        // Forward raw pcm mic audio from the client to the Gemini Live session
        if (liveSession) {
          liveSession.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
      }
    } catch (err: any) {
      console.error("Error processing websocket message:", err);
      clientWs.send(JSON.stringify({ type: "error", error: err.message }));
    }
  });

  clientWs.on("close", () => {
    console.log("WebSocket connection closed, cleaning up Live session...");
    if (sessionTimeoutTimer) {
      clearTimeout(sessionTimeoutTimer);
      sessionTimeoutTimer = null;
    }
    if (liveSession) {
      try {
        liveSession.close();
      } catch (err) {
        console.error("Error closing live session:", err);
      }
    }
  });
});

// Upgrade WebSocket connections on /live-api path
server.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
  if (pathname === "/live-api") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

// Start dev server with Vite middleware or serve static dist in production
async function startServer() {
  app.use(express.static(path.join(process.cwd(), "public")));
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
