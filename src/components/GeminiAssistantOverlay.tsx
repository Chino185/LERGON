import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  X,
  Volume2,
  VolumeX,
  Calendar,
  Play,
  Pause,
  Settings,
  CheckCircle2,
  ChevronRight,
  Info,
  TrendingUp,
  HelpCircle,
  Check,
  ChevronDown,
  Phone,
  Mic,
  MicOff,
  Briefcase,
  Layers,
  Users,
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BusinessConfig, InventoryItem, CreditAccount, StockAdjustment, CreditTransaction, PendingRestock, BackendNotification, Organization } from "../types";
import { getRecentActivityContext, queryActivityLog, activityLogger } from "../utils/activityLogger";
import { executeAppActionAsync, validateActionPermission } from "../utils/actionRegistry";

interface GeminiAssistantOverlayProps {
  inventory: InventoryItem[];
  creditAccounts: CreditAccount[];
  adjustments: StockAdjustment[];
  transactions: CreditTransaction[];
  pendingRestocks?: PendingRestock[];
  config: BusinessConfig;
  activeScreen: string;
  setActiveScreen: (screen: any) => void;
  userRole?: number;
  setInventory?: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  setCreditAccounts?: React.Dispatch<React.SetStateAction<CreditAccount[]>>;
  setAdjustments?: React.Dispatch<React.SetStateAction<StockAdjustment[]>>;
  setTransactions?: React.Dispatch<React.SetStateAction<CreditTransaction[]>>;
  setPendingRestocks?: React.Dispatch<React.SetStateAction<PendingRestock[]>>;
  setConfig?: React.Dispatch<React.SetStateAction<BusinessConfig>>;
  backendNotifications?: BackendNotification[];
  readNotificationIds?: string[];
  currentUserName?: string;
  currentOrg?: Organization;
  dataReady?: boolean;

}

export default function GeminiAssistantOverlay({
  inventory,
  creditAccounts,
  adjustments,
  transactions,
  pendingRestocks = [],
  config,
  activeScreen,
  setActiveScreen,
  userRole,
  setInventory,
  setCreditAccounts,
  setAdjustments,
  setTransactions,
  setPendingRestocks,
  setConfig,
  backendNotifications = [],
  readNotificationIds = [],
  currentUserName = "",
  currentOrg,
  dataReady = false
}: GeminiAssistantOverlayProps) {
  // AI Hub UI Panel states
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"health" | "speech" | "live">("health");

  // Weekly Speech Advisor config
  const [closingDay, setClosingDay] = useState<number>(() => {
    const saved = localStorage.getItem("velo_ai_closing_day");
    return saved !== null ? parseInt(saved, 10) : 0; // Default to 0 (Sunday)
  });

  const [autoWakeEnabled, setAutoWakeEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("velo_ai_auto_wake");
    return saved !== null ? saved === "true" : true; // Default to true
  });

  // Voice Live API states (original Gemini audio websocket)
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"disconnected" | "connecting" | "listening" | "speaking" | "error">("disconnected");
  const [voiceError, setVoiceError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [isWakeWordListening, setIsWakeWordListening] = useState(false);

  // DSP Background Noise Cancellation & Audio Filter states
  const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("velo_ai_noise_cancellation");
    return saved !== null ? saved === "true" : true;
  });
  const [noiseSensitivity, setNoiseSensitivity] = useState<"low" | "medium" | "high">((): "low" | "medium" | "high" => {
    const saved = localStorage.getItem("velo_ai_noise_sensitivity");
    if (saved === "low" || saved === "high" || saved === "medium") return saved;
    return "medium";
  });
  const [currentRms, setCurrentRms] = useState<number>(0);
  const [isNoiseGateActive, setIsNoiseGateActive] = useState<boolean>(false);

  // Audio stream references
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const recognitionRef = useRef<any>(null);
  const latestLiveDataRef = useRef({ inventory, creditAccounts, adjustments, transactions, pendingRestocks, config });
  latestLiveDataRef.current = { inventory, creditAccounts, adjustments, transactions, pendingRestocks, config };

  // DSP Audio Ref pointers for thread safe callback read
  const noiseCancellationRef = useRef<boolean>(noiseCancellationEnabled);
  const noiseSensitivityRef = useRef<"low" | "medium" | "high">(noiseSensitivity);
  const noiseGateThresholdRef = useRef<number>(
    noiseSensitivity === "low" ? 0.008 : noiseSensitivity === "high" ? 0.025 : 0.015
  );

  useEffect(() => {
    noiseCancellationRef.current = noiseCancellationEnabled;
    localStorage.setItem("velo_ai_noise_cancellation", String(noiseCancellationEnabled));
  }, [noiseCancellationEnabled]);

  useEffect(() => {
    noiseSensitivityRef.current = noiseSensitivity;
    localStorage.setItem("velo_ai_noise_sensitivity", noiseSensitivity);
    noiseGateThresholdRef.current = 
      noiseSensitivity === "low" ? 0.008 : noiseSensitivity === "high" ? 0.025 : 0.015;
  }, [noiseSensitivity]);

  // AI-driven real-time data corrections toast notifications state
  const [correctionsList, setCorrectionsList] = useState<{
    id: string;
    title: string;
    message: string;
    timestamp: string;
  }[]>([]);

  const formatMoney = (amount: number) => {
    return `${config?.currencySymbol || "$"}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const addCorrectionToast = (title: string, message: string) => {
    const timestamp = new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const id = 'corr_' + Math.random().toString(36).substr(2, 9);
    setCorrectionsList(prev => [{ id, title, message, timestamp }, ...prev]);
    
    // Automatically clear toast after 8 seconds
    setTimeout(() => {
      setCorrectionsList(prev => prev.filter(item => item.id !== id));
    }, 8000);
  };

  // Business Health Score calculations
  const healthMetrics = React.useMemo(() => {
    // 1. Inventory sub-score
    const totalItemsTracked = inventory.length;
    const outOfStockCount = inventory.filter(i => (i.quantity || 0) <= 0).length;
    const lowStockCount = inventory.filter(i => (i.quantity || 0) > 0 && (i.quantity || 0) <= (i.reorderPoint || 0)).length;

    let inventoryScore = 100;
    if (totalItemsTracked > 0) {
      const outDeduction = (outOfStockCount / totalItemsTracked) * 100;
      const lowDeduction = (lowStockCount / totalItemsTracked) * 40;
      inventoryScore = Math.max(0, 100 - (outDeduction + lowDeduction));
    }

    // 2. Credit Risk sub-score
    const totalAccounts = creditAccounts.length;
    const highOrCriticalRiskCount = creditAccounts.filter(a => {
      const amt = a.remainingAmount || 0;
      return a.status === 'overdue' || (a.status === 'active' && amt > 1000);
    }).length;

    let creditScore = 100;
    if (totalAccounts > 0) {
      creditScore = Math.max(0, 100 - (highOrCriticalRiskCount / totalAccounts) * 100);
    }

    // 3. Discrepancy sub-score
    const unresolvedAdjustments = adjustments.filter(a => a.isFlagged && !a.isResolved).length;
    const unresolvedTransactions = transactions.filter(t => t.isFlagged && !t.isResolved).length;
    const totalUnresolved = unresolvedAdjustments + unresolvedTransactions;
    const discrepancyScore = Math.max(0, 100 - totalUnresolved * 15);

    // 4. Combined weighted Score
    const finalScore = Math.round((inventoryScore * 0.4) + (creditScore * 0.4) + (discrepancyScore * 0.2));

    return {
      finalScore,
      inventoryScore,
      outOfStockCount,
      lowStockCount,
      totalItemsTracked,
      creditScore,
      highOrCriticalRiskCount,
      totalAccounts,
      discrepancyScore,
      totalUnresolved
    };
  }, [inventory, creditAccounts, adjustments, transactions]);

  // Programmatic commentary fallback
  const getProgrammaticHealthExplanation = () => {
    if (healthMetrics.finalScore >= 90) {
      return "Excellent operation. High liquidity, balanced stock buffers, and minimal customer debtor risk.";
    } else if (healthMetrics.finalScore >= 75) {
      return "Satisfactory standing. Stock buffers are healthy, but address pending overdue debtor ledgers.";
    } else if (healthMetrics.finalScore >= 50) {
      return "Warning: Capital tied in high debtor risk and stockouts. Optimize order margins.";
    } else {
      return "Critical action required: Immediate reconciliation of discrepancies and urgent debt recovery needed.";
    }
  };

  const [healthExplanation, setHealthExplanation] = useState<string>(() => {
    const saved = localStorage.getItem(`velo_health_advice_${config?.businessName || "default"}`);
    if (saved) return saved;
    return getProgrammaticHealthExplanation();
  });

  const [loadingHealth, setLoadingHealth] = useState(false);

  // Fetch advice from Gemini
  const fetchHealthExplanation = async () => {
    setLoadingHealth(true);
    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are an expert SME business consultant. Analyze the following inventory and credit metrics of my shop "${config?.businessName || "my shop"}" and write a single-sentence witty, highly actionable advisory commentary. Be concise (max 20 words). Metrics: Overall Health Score: ${healthMetrics.finalScore}/100, Inventory score: ${healthMetrics.inventoryScore}/100 (${healthMetrics.outOfStockCount} out of stock, ${healthMetrics.lowStockCount} low), Credit risk score: ${healthMetrics.creditScore}/100 (${healthMetrics.highOrCriticalRiskCount} accounts at risk), Data integrity score: ${healthMetrics.discrepancyScore}/100 (${healthMetrics.totalUnresolved} flags).`,
          inventory,
          creditAccounts,
          adjustments,
          transactions,
          config
        })
      });
      const data = await response.json();
      const advice = data.text || data.reply;
      if (advice) {
        setHealthExplanation(advice);
        localStorage.setItem(`velo_health_advice_${config?.businessName || "default"}`, advice);
      }
    } catch (e) {
      setHealthExplanation(getProgrammaticHealthExplanation());
    } finally {
      setLoadingHealth(false);
    }
  };

  // Fetch explanation when metrics change on load
  useEffect(() => {
    const saved = localStorage.getItem(`velo_health_advice_${config?.businessName || "default"}`);
    if (!saved) {
      fetchHealthExplanation();
    }
  }, [healthMetrics.finalScore]);

  // Real-time activity feed pipeline: automatically push new logged actions to active Live session
  useEffect(() => {
    const unsubscribe = activityLogger.subscribe((activity, summary) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const recentCtx = getRecentActivityContext(adjustments, transactions, inventory, creditAccounts, 20);
        wsRef.current.send(JSON.stringify({
          type: "realtime_activity",
          activitySummary: summary,
          recentActivityContext: recentCtx,
          currentDataSnapshot: {
            inventory,
            creditAccounts,
            adjustments: adjustments.slice(0, 30),
            transactions: transactions.slice(0, 30),
            pendingRestocks,
            dashboardKpis: {
              ...calculateDashboardMetrics(inventory, creditAccounts, adjustments, transactions),
              stockInHandBasis: "sum of current inventory quantity multiplied by current unit price"
            },
            applicationContext: buildRoleAwareApplicationContext()
          }
        }));
      }
    });

    return () => unsubscribe();
  }, [adjustments, transactions, inventory, creditAccounts, pendingRestocks]);

  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const recentCtx = getRecentActivityContext(adjustments, transactions, inventory, creditAccounts, 20);
      wsRef.current.send(JSON.stringify({
        type: "realtime_activity",
        activitySummary: "System state sync updated recent activity context.",
        recentActivityContext: recentCtx,
        currentDataSnapshot: {
          inventory,
          creditAccounts,
          adjustments: adjustments.slice(0, 30),
          transactions: transactions.slice(0, 30),
          pendingRestocks,
          dashboardKpis: {
            ...calculateDashboardMetrics(inventory, creditAccounts, adjustments, transactions),
            stockInHandBasis: "sum of current inventory quantity multiplied by current unit price"
          },
          applicationContext: buildRoleAwareApplicationContext()
        }
      }));
    }
  }, [adjustments, transactions, inventory, creditAccounts, pendingRestocks]);

  // Text-To-Speech variables and states
  const [isSpeakingBriefing, setIsSpeakingBriefing] = useState(false);
  const [speechScript, setSpeechScript] = useState("");

  const getBriefingText = () => {
    return `Hello! This is your weekly AI business health advisory for ${config?.businessName || "your business"}. Your overall health score has compiled at ${healthMetrics.finalScore} points out of 100. Let's analyze the core modules. First, stock buffer integrity is registered at ${Math.round(healthMetrics.inventoryScore)} percent, with ${healthMetrics.outOfStockCount} items completely depleted, and ${healthMetrics.lowStockCount} items at low threshold. Second, debtor credit security is rated at ${Math.round(healthMetrics.creditScore)} percent, holding ${healthMetrics.highOrCriticalRiskCount} accounts at critical or overdue status. Finally, ledger integrity is standing at ${Math.round(healthMetrics.discrepancyScore)} percent with ${healthMetrics.totalUnresolved} unresolved ledger flags. Here is my strategic advice: "${healthExplanation}" Have a highly productive week ahead!`;
  };

  useEffect(() => {
    setSpeechScript(getBriefingText());
  }, [
    healthMetrics.finalScore,
    healthMetrics.inventoryScore,
    healthMetrics.outOfStockCount,
    healthMetrics.lowStockCount,
    healthMetrics.creditScore,
    healthMetrics.highOrCriticalRiskCount,
    healthMetrics.discrepancyScore,
    healthMetrics.totalUnresolved,
    healthExplanation,
    config?.businessName
  ]);

  const speakBriefing = () => {
    if (!('speechSynthesis' in window)) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isSpeakingBriefing) {
      window.speechSynthesis.cancel();
      setIsSpeakingBriefing(false);
      return;
    }

    setIsSpeakingBriefing(true);
    // Mark today as spoken to satisfy weekly condition
    const todayStr = new Date().toDateString();
    localStorage.setItem('velo_ai_last_spoken_date', todayStr);
    setShowWakePrompt(false);

    const text = getBriefingText();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // elegant professional tempo
    utterance.pitch = 1.0;

    // Auto-select a high-quality English voice
    const voices = window.speechSynthesis.getVoices();
    const premiumVoice = voices.find(v => 
      v.name.includes("Google US English") || 
      v.name.includes("Microsoft Zira") || 
      v.name.includes("Samantha") ||
      v.lang.startsWith("en")
    );
    if (premiumVoice) {
      utterance.voice = premiumVoice;
    }

    utterance.onend = () => {
      setIsSpeakingBriefing(false);
    };

    utterance.onerror = () => {
      setIsSpeakingBriefing(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Close panel helper
  const closePanel = () => {
    setIsPanelOpen(false);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeakingBriefing(false);
  };

  // Days mapping
  const DAYS_OF_WEEK = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" }
  ];

  const currentDayNum = new Date().getDay();
  const currentDayLabel = DAYS_OF_WEEK.find(d => d.value === currentDayNum)?.label || "Unknown";

  // Auto-wake speech advisory check
  const [showWakePrompt, setShowWakePrompt] = useState(false);

  useEffect(() => {
    const todayNum = new Date().getDay();
    if (todayNum === closingDay && autoWakeEnabled) {
      const todayStr = new Date().toDateString();
      const lastSpoken = localStorage.getItem('velo_ai_last_spoken_date');
      if (lastSpoken !== todayStr) {
        setShowWakePrompt(true);
      }
    } else {
      setShowWakePrompt(false);
    }
  }, [closingDay, autoWakeEnabled]);

  // Clean-up voice synthesis on dismount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      disconnectVoiceSession();
    };
  }, []);

  // Passive voice wake-word (RICHARD) detection
  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass || !autoWakeEnabled || !dataReady || isVoiceConnected || voiceStatus === "connecting") {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
        setIsWakeWordListening(false);
      }
      return;
    }

    let active = true;
    let recognition: any = null;

    const initRecognition = () => {
      if (!active) return;
      try {
        recognition = new SpeechRecognitionClass();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          if (active) setIsWakeWordListening(true);
        };

        recognition.onresult = (event: any) => {
          if (!active) return;
          const results = event.results;
          for (let i = event.resultIndex; i < results.length; i++) {
            if (results[i].isFinal) {
              const text = results[i][0].transcript.trim().toLowerCase();
              console.log("Wake-word passive speech transcript:", text);
              if (text.includes("lergon") || text.includes("richard")) {
                console.log("Wake word 'LERGON' matched! Activating interactive voice session...");
                // Trigger connection with wake-word greeting
                connectVoiceSession(true);
                break;
              }
            }
          }
        };

        recognition.onerror = (err: any) => {
          console.warn("Passive wake-word speech recognition error:", err);
        };

        recognition.onend = () => {
          if (active && !isVoiceConnected && voiceStatus !== "connecting") {
            // Restart listening continuously
            setTimeout(() => {
              if (active && !isVoiceConnected && voiceStatus !== "connecting") {
                try {
                  recognition.start();
                } catch (e) {
                  // Ignore start failure
                }
              }
            }, 1000);
          } else {
            setIsWakeWordListening(false);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.error("Failed to start speech recognition for wake word:", err);
      }
    };

    initRecognition();

    return () => {
      active = false;
      if (recognition) {
        try {
          recognition.stop();
        } catch (e) {}
      }
      recognitionRef.current = null;
      setIsWakeWordListening(false);
    };
  }, [autoWakeEnabled, dataReady, isVoiceConnected, voiceStatus]);

  const calculateDashboardMetrics = (
    items: InventoryItem[],
    accounts: CreditAccount[],
    stockAdjustments: StockAdjustment[],
    ledgerTransactions: CreditTransaction[]
  ) => {
    const stockInHandRetailValue = items.reduce((total, item) => {
      return total + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
    }, 0);
    const receivablesTotal = accounts
      .filter(account => account.type === "receivable" && account.status !== "settled")
      .reduce((total, account) => total + (Number(account.remainingAmount) || 0), 0);

    const persistedTotals = ledgerTransactions.reduce((totals, transaction) => {
      const transactionType = transaction.transactionType;
      const lineItems = Array.isArray(transaction.lineItems) ? transaction.lineItems : [];
      const saleLines = lineItems.filter(line => line.item_id && line.quantity && line.unit_price !== undefined);
      if (transactionType === "repayment") {
        const account = accounts.find(entry => entry.id === transaction.creditAccountId);
        if (account?.type === "receivable") {
          totals.paidCredit += Number(transaction.amount) || 0;
          totals.hasPersistedMovement = true;
        }
        return totals;
      }
      if (saleLines.length === 0) return totals;
      const amount = saleLines.reduce((sum, line) => {
        return sum + Math.abs(Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
      }, 0);
      if (transactionType === "sell") totals.cash += amount;
      if (transactionType === "credit") totals.credit += amount;
      totals.hasPersistedMovement = true;
      return totals;
    }, { cash: 0, credit: 0, paidCredit: 0, hasPersistedMovement: false });

    const saleTotals = persistedTotals.hasPersistedMovement
      ? persistedTotals
      : stockAdjustments
        .filter(adjustment => adjustment.type === "sale_out")
        .reduce((totals, adjustment) => {
          const item = items.find(entry => entry.id === adjustment.itemId);
          const amount = Math.abs(Number(adjustment.qtyChanged) || 0) * (Number(adjustment.unitPriceSnapshot ?? item?.unitPrice) || 0);
          const notes = (adjustment.notes || "").toLowerCase();
          const isCredit = Boolean(adjustment.creditAccountId) || /credit|credited|crediting|sold on credit|on credit|debt|receivable|billed|pay later|unpaid|terms/.test(notes);
          if (isCredit) totals.credit += amount;
          else totals.cash += amount;
          return totals;
        }, { cash: 0, credit: 0, paidCredit: 0, hasPersistedMovement: false });

    const valueSold = saleTotals.cash + saleTotals.paidCredit;
    const totalInventoryValue = stockInHandRetailValue + valueSold + receivablesTotal;
    return {
      stockInHandValue: Math.max(0, totalInventoryValue - valueSold - receivablesTotal),
      totalInventoryValue,
      valueSold,
      assetOnCredit: receivablesTotal,
      cashSalesValue: saleTotals.cash,
      paidCreditValue: saleTotals.paidCredit,
      creditSalesValue: saleTotals.credit
    };
  };

  const calculateDashboardStockInHand = (
    items: InventoryItem[],
    accounts: CreditAccount[] = creditAccounts,
    stockAdjustments: StockAdjustment[] = adjustments,
    ledgerTransactions: CreditTransaction[] = transactions
  ) => calculateDashboardMetrics(items, accounts, stockAdjustments, ledgerTransactions).stockInHandValue;

  const calculateTransactionKpiImpact = (transaction: CreditTransaction, accounts: CreditAccount[]) => {
    const amount = Number(transaction.amount) || 0;
    const account = accounts.find(entry => entry.id === transaction.creditAccountId);
    if (transaction.type === "pay" && account?.type === "receivable") {
      return { totalInventoryValue: 0, stockInHand: 0, valueSold: amount, assetOnCredit: -amount };
    }
    if ((transaction.type === "borrow" || transaction.type === "charge") && account?.type === "receivable") {
      return { totalInventoryValue: 0, stockInHand: 0, valueSold: 0, assetOnCredit: amount };
    }
    return { totalInventoryValue: 0, stockInHand: 0, valueSold: 0, assetOnCredit: 0 };
  };

  const calculateActivityKpiImpact = (adjustment: StockAdjustment, items: InventoryItem[], accounts: CreditAccount[]) => {
    const item = items.find(entry => entry.id === adjustment.itemId);
    const amount = Math.abs(Number(adjustment.qtyChanged) || 0) * (Number(adjustment.unitPriceSnapshot ?? item?.unitPrice) || 0);
    const notes = (adjustment.notes || "").toLowerCase();
    const isCreditSale = adjustment.type === "sale_out" && (Boolean(adjustment.creditAccountId) || /credit|credited|on credit|debt|receivable|pay later|unpaid|terms/.test(notes));
    const zero = { totalInventoryValue: 0, stockInHand: 0, valueSold: 0, assetOnCredit: 0 };
    if (adjustment.type === "purchase_in" || adjustment.type === "initial_stock" || adjustment.type === "returned") {
      return { totalInventoryValue: amount, stockInHand: amount, valueSold: 0, assetOnCredit: 0 };
    }
    if (adjustment.type === "damaged") {
      return { totalInventoryValue: -amount, stockInHand: -amount, valueSold: 0, assetOnCredit: 0 };
    }
    if (adjustment.type === "sale_out") {
      return isCreditSale
        ? { totalInventoryValue: 0, stockInHand: -amount, valueSold: 0, assetOnCredit: amount }
        : { totalInventoryValue: 0, stockInHand: -amount, valueSold: amount, assetOnCredit: 0 };
    }
    if (adjustment.type === "audit_adjustment") {
      const signedAmount = Number(adjustment.qtyChanged) >= 0 ? amount : -amount;
      return { totalInventoryValue: signedAmount, stockInHand: signedAmount, valueSold: 0, assetOnCredit: 0 };
    }
    return zero;
  };

  const buildRoleAwareApplicationContext = () => {
    const isAdministrator = userRole === 2;
    const safeInventory = inventory.map(item => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      category: item.category,
      quantity: Number(item.quantity) || 0,
      reorderPoint: Number(item.reorderPoint) || 0,
      unitCost: Number(item.unitCost) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      supplier: item.supplier,
      location: item.location,
      imageUrl: item.imageUrl
    }));
    const safeCreditAccounts = creditAccounts.map(account => ({
      id: account.id,
      name: account.name,
      type: account.type,
      phone: account.phone,
      email: account.email,
      totalAmount: Number(account.totalAmount) || 0,
      remainingAmount: Number(account.remainingAmount) || 0,
      status: account.status,
      dueDate: account.dueDate,
      dateOfCrediting: account.dateOfCrediting,
      paymentDate: account.paymentDate
    }));
    const safeTransactions = transactions.map(transaction => ({
      id: transaction.id,
      creditAccountId: transaction.creditAccountId,
      accountName: transaction.accountName,
      type: transaction.type,
      amount: Number(transaction.amount) || 0,
      date: transaction.date,
      notes: transaction.notes,
      paymentMethod: transaction.paymentMethod,
      performedBy: transaction.performedBy,
      isFlagged: transaction.isFlagged,
      isResolved: transaction.isResolved,
      kpiImpact: calculateTransactionKpiImpact(transaction, creditAccounts)
    }));
    const safeAdjustments = adjustments.map(adjustment => ({
      id: adjustment.id,
      itemId: adjustment.itemId,
      itemName: adjustment.itemName,
      qtyChanged: Number(adjustment.qtyChanged) || 0,
      type: adjustment.type,
      date: adjustment.date,
      notes: adjustment.notes,
      unitPriceSnapshot: adjustment.unitPriceSnapshot,
      creditAccountId: adjustment.creditAccountId,
      performedBy: adjustment.performedBy,
      isFlagged: adjustment.isFlagged,
      isResolved: adjustment.isResolved,
      correctionNotes: adjustment.correctionNotes,
      kpiImpact: calculateActivityKpiImpact(adjustment, inventory, creditAccounts)
    }));
    const safeNotifications = backendNotifications
      .filter(notification => isAdministrator || !/restock validation|pending restock|activity log|system settings|currency change|invite pin|business profile/i.test(`${notification.eventKey} ${notification.title} ${notification.message}`))
      .map(notification => ({
        id: notification.id,
        eventKey: notification.eventKey,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        severity: notification.severity,
        relatedRef: notification.relatedRef,
        targetScreen: notification.targetScreen,
        targetTab: notification.targetTab,
        isActive: notification.isActive,
        createdAt: notification.createdAt,
        isRead: readNotificationIds.includes(notification.id)
      }));
    const safePendingRestocks = isAdministrator
      ? pendingRestocks
      : pendingRestocks.filter(restock => !currentUserName || restock.submittedBy === currentUserName);
    const dashboardMetrics = calculateDashboardMetrics(inventory, creditAccounts, adjustments, transactions);
    const sessionActivityLog = activityLogger.getSessionLogs();

    return {
      currentScreen: activeScreen,
      operator: {
        role: isAdministrator ? "Administrator" : "Attendant",
        name: currentUserName || "Current operator"
      },
      pageAvailability: {
        dashboard: true,
        inventory: true,
        transactions: true,
        credit: true,
        invoice: true,
        report: true,
        notifications: true,
        settings: isAdministrator,
        activity_log: isAdministrator
      },
      pages: {
        dashboard: {
          ...dashboardMetrics,
          stockInHandBasis: "current inventory quantity multiplied by current unit price",
          inventoryItemCount: safeInventory.length,
          lowStockItems: safeInventory.filter(item => item.quantity > 0 && item.quantity <= item.reorderPoint).map(item => ({ id: item.id, name: item.name, quantity: item.quantity, reorderPoint: item.reorderPoint }))
        },
        inventory: {
          items: safeInventory,
          pendingRestocks: safePendingRestocks
        },
        transactions: {
          salesAndAdjustments: safeAdjustments,
          creditLedger: safeTransactions
        },
        credit: {
          accounts: safeCreditAccounts,
          paymentLedger: safeTransactions.filter(transaction => transaction.type === "pay")
        },
        invoice: {
          searchableInventory: safeInventory,
          availableCreditAccounts: safeCreditAccounts
        },
        report: {
          inventory: safeInventory,
          adjustments: safeAdjustments,
          transactions: safeTransactions,
          creditAccounts: safeCreditAccounts,
          ...dashboardMetrics,
          activityKpiImpactModel: "Each activity includes kpiImpact showing its change to totalInventoryValue, stockInHand, valueSold, and assetOnCredit."
        },
        notifications: {
          notifications: safeNotifications
        },
        settings: isAdministrator
          ? { businessName: config.businessName, country: config.country, currency: config.currency, currencySymbol: config.currencySymbol, language: config.language, lowStockThresholdDefault: config.lowStockThresholdDefault, activeInviteCode: currentOrg?.activeInvite?.code, activeInviteExpiresAt: currentOrg?.activeInvite?.expiresAt, activeInviteIsUsed: currentOrg?.activeInvite?.isUsed }
          : { unavailable: true, reason: "Administrator permission is required." },
        activity_log: isAdministrator
          ? { adjustments: safeAdjustments, transactions: safeTransactions }
          : { unavailable: true, reason: "Administrator permission is required." }
      },
      sessionActivityLog,
      generatedAt: new Date().toISOString(),
      source: "live Supabase-backed React state",
      restrictions: isAdministrator
        ? []
        : ["Settings and Activity Log are unavailable to Attendants.", "Organization-wide settings, invite management, KPI overrides, deletion, and administrative corrections require Administrator permission."]
    };
  };

  // Live WebSocket methods
  const connectVoiceSession = async (isWakeWordTriggered: boolean = false) => {
    if (!dataReady) {
      setVoiceError("Business data is still loading. Please try again in a moment.");
      setVoiceStatus("error");
      return;
    }

    try {
      setVoiceStatus("connecting");
      setVoiceError("");

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const inputAudioCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputAudioCtx = new AudioContextClass({ sampleRate: 24000 });
      
      if (inputAudioCtx.state === "suspended") {
        await inputAudioCtx.resume();
      }
      if (outputAudioCtx.state === "suspended") {
        await outputAudioCtx.resume();
      }

      inputAudioCtxRef.current = inputAudioCtx;
      outputAudioCtxRef.current = outputAudioCtx;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/live-api`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const liveData = latestLiveDataRef.current;
        const dashboardMetrics = calculateDashboardMetrics(liveData.inventory, liveData.creditAccounts, liveData.adjustments, liveData.transactions);
        const applicationContext = buildRoleAwareApplicationContext();
        const recentCtx = getRecentActivityContext(liveData.adjustments, liveData.transactions, liveData.inventory, liveData.creditAccounts, 20);
        ws.send(JSON.stringify({
          type: "init",
          businessName: liveData.config?.businessName || "",
          inventory: liveData.inventory,
          creditAccounts: liveData.creditAccounts,
          adjustments: liveData.adjustments,
          transactions: liveData.transactions,
          pendingRestocks: liveData.pendingRestocks,
          dashboardKpis: {
            ...dashboardMetrics,
            stockInHandBasis: "sum of current inventory quantity multiplied by current unit price"
          },
          applicationContext,
          userRole: userRole,
          isWakeWordTriggered: isWakeWordTriggered,
          recentActivityContext: recentCtx
        }));
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === "status" && msg.status === "ready") {
          setIsVoiceConnected(true);
          setVoiceStatus("listening");
          startMicRecording();
        } else if (msg.type === "audio") {
          setVoiceStatus("speaking");
          playAudioChunk(msg.audio);
        } else if (msg.type === "interrupted") {
          stopAudioPlayback();
          setVoiceStatus("listening");
        } else if (msg.type === "navigate") {
          const allowedPages = ["dashboard", "inventory", "credit", "transactions", "notifications", "report", "invoice"];
          if (userRole === 2) {
            allowedPages.push("settings", "activity_log");
          }
          if (allowedPages.includes(msg.page)) {
            setActiveScreen(msg.page);
          }
        } else if (msg.type === "tool_call") {
          const { name, args } = msg;
          const permission = validateActionPermission(name, userRole ?? 5);
          const restrictedAttendantPage = name === "navigate_to_page" && userRole !== 2 && ["settings", "activity_log"].includes(args?.page);
          if (msg.blocked || !permission.allowed || restrictedAttendantPage) {
            const reason = permission.reason || "Administrator permission is required for this action. No change was made.";
            addCorrectionToast("AI Action Blocked", reason);
            console.warn("Blocked Gemini action:", name, args, reason);
            return;
          }

          console.log("🤖 [GEMINI LIVE OVERLAY] Executing tool call request from AI:", name, args);

          // Execute centralized action registry handler
          const actionResult = await executeAppActionAsync(name, args, {
            inventory,
            setInventory,
            adjustments,
            setAdjustments,
            creditAccounts,
            setCreditAccounts,
            transactions,
            setTransactions,
            config,
            userRole,
            setActiveScreen,
            performedBy: 'RICHARD. (AI Assistant)'
          });

          console.log("⚡ [ACTION REGISTRY RESULT]:", actionResult);

          if (actionResult.success) {
            addCorrectionToast("AI Action Executed", actionResult.message);
          } else {
            addCorrectionToast("AI Action Blocked", actionResult.message);
          }

          if (name === "navigate_to_page") {
            const page = args.page;
            const allowedPages = ["dashboard", "inventory", "credit", "transactions", "notifications", "report", "invoice", "settings"];
            if (userRole === 2) {
              allowedPages.push("activity_log");
            }
            if (allowedPages.includes(page)) {
              setActiveScreen(page);
            }
          } else if (name === "scroll_page") {
            const { direction, amount } = args;
            const scrollContainers = [
              document.querySelector('main.overflow-y-auto'),
              document.documentElement,
              document.body,
              window
            ];

            for (const target of scrollContainers) {
              if (!target) continue;

              let clientHeight = 0;
              let scrollHeight = 0;

              if (target === window) {
                clientHeight = window.innerHeight;
                scrollHeight = document.documentElement.scrollHeight;
              } else {
                clientHeight = (target as HTMLElement).clientHeight;
                scrollHeight = (target as HTMLElement).scrollHeight;
              }

              if (target === window || scrollHeight > clientHeight) {
                let scrollDistance = 400;
                if (amount === 'half_page') {
                  scrollDistance = clientHeight * 0.5;
                } else if (amount === 'full_page') {
                  scrollDistance = clientHeight * 0.85;
                } else if (amount === 'small') {
                  scrollDistance = 150;
                }

                if (direction === 'down') {
                  if (target === window) {
                    window.scrollBy({ top: scrollDistance, behavior: 'smooth' });
                  } else {
                    (target as HTMLElement).scrollBy({ top: scrollDistance, behavior: 'smooth' });
                  }
                } else if (direction === 'up') {
                  if (target === window) {
                    window.scrollBy({ top: -scrollDistance, behavior: 'smooth' });
                  } else {
                    (target as HTMLElement).scrollBy({ top: -scrollDistance, behavior: 'smooth' });
                  }
                } else if (direction === 'top') {
                  if (target === window) {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    (target as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
                  }
                } else if (direction === 'bottom') {
                  if (target === window) {
                    window.scrollTo({ top: scrollHeight, behavior: 'smooth' });
                  } else {
                    (target as HTMLElement).scrollTo({ top: scrollHeight, behavior: 'smooth' });
                  }
                }
              }
            }

            addCorrectionToast(
              "Viewport Scrolled",
              `AI scrolled your screen ${direction === "down" ? "downwards" : direction === "up" ? "upwards" : direction === "top" ? "to the top" : "to the bottom"}.`
            );
          } else if (name === "correct_inventory_stock") {
            const { itemId, itemName, newQuantity, reason } = args;
            if (setInventory) {
              let targetItem = inventory.find(i => i.id === itemId);
              if (!targetItem && itemName) {
                const lowerName = itemName.toLowerCase();
                targetItem = inventory.find(i => i.name.toLowerCase().includes(lowerName) || lowerName.includes(i.name.toLowerCase()));
              }
              
              if (targetItem) {
                const targetId = targetItem.id;
                const targetName = targetItem.name;
                const prevQty = targetItem.quantity;
                const diff = newQuantity - prevQty;
                
                // Update item quantity
                setInventory(prev => prev.map(item => {
                  if (item.id === targetId) {
                    return { ...item, quantity: newQuantity, lastUpdated: new Date().toISOString() };
                  }
                  return item;
                }));
                
                // Append physical count stock adjustment
                if (setAdjustments) {
                  setAdjustments(prevAdj => [
                    {
                      id: 'adj_corr_' + Math.random().toString(36).substr(2, 9),
                      itemId: targetId,
                      itemName: targetName,
                      qtyChanged: diff,
                      type: 'audit_adjustment',
                      date: new Date().toISOString().split('T')[0],
                      notes: reason || `AI Corrective Count Update (Prev: ${prevQty} units)`,
                      performedBy: 'RICHARD. (AI Partner)',
                      isFlagged: false,
                      isResolved: true,
                      originalQtyChanged: prevQty,
                      correctionNotes: `AI Count Sync applied: Adjusted by ${diff > 0 ? '+' : ''}${diff} units.`
                    },
                    ...prevAdj
                  ]);
                }
                
                addCorrectionToast(
                  "Inventory Stock Corrected",
                  `Reset '${targetName}' count from ${prevQty} to ${newQuantity} units. Discrepancy resolved.`
                );
              } else {
                console.error("Item not found for correction:", itemName || itemId);
                addCorrectionToast(
                  "Correction Failed",
                  `Unable to locate item matching '${itemName || itemId}' to apply stock correction.`
                );
              }
            }
          } else if (name === "correct_credit_balance") {
            const { accountId, accountName, newRemainingAmount, reason } = args;
            if (setCreditAccounts) {
              let targetAccount = creditAccounts.find(a => a.id === accountId);
              if (!targetAccount && accountName) {
                const lowerName = accountName.toLowerCase();
                targetAccount = creditAccounts.find(a => a.name.toLowerCase().includes(lowerName) || lowerName.includes(a.name.toLowerCase()));
              }
              
              if (targetAccount) {
                const targetId = targetAccount.id;
                const targetAccName = targetAccount.name;
                const prevDebt = targetAccount.remainingAmount;
                const diff = prevDebt - newRemainingAmount;
                
                setCreditAccounts(prevAccounts => prevAccounts.map(acc => {
                  if (acc.id === targetId) {
                    const finalStatus = newRemainingAmount === 0 
                      ? 'settled' 
                      : newRemainingAmount < acc.totalAmount 
                      ? 'partially_paid' 
                      : acc.status;
                    return { 
                      ...acc, 
                      remainingAmount: newRemainingAmount, 
                      status: finalStatus,
                      lastUpdated: new Date().toISOString() 
                    };
                  }
                  return acc;
                }));
                
                // Log transaction audit
                if (setTransactions) {
                  setTransactions(prevTx => [
                    {
                      id: 'ctx_corr_' + Math.random().toString(36).substr(2, 9),
                      creditAccountId: targetId,
                      accountName: targetAccName,
                      type: diff > 0 ? 'pay' : 'charge',
                      amount: Math.abs(diff),
                      date: new Date().toISOString().split('T')[0],
                      notes: reason || `AI Corrective Balance Sync (Prev: ${prevDebt})`,
                      performedBy: 'RICHARD. (AI Partner)',
                      isFlagged: false,
                      isResolved: true,
                      originalAmount: prevDebt,
                      correctionNotes: `AI balance corrected to ${newRemainingAmount}`
                    },
                    ...prevTx
                  ]);
                }
                
                addCorrectionToast(
                  "Credit Account Adjusted",
                  `Synchronized '${targetAccName}' remaining debt from ${formatMoney(prevDebt)} to ${formatMoney(newRemainingAmount)}.`
                );
              } else {
                console.error("Account not found for correction:", accountName || accountId);
                addCorrectionToast(
                  "Correction Failed",
                  `Unable to locate credit profile matching '${accountName || accountId}'.`
                );
              }
            }
          } else if (name === "resolve_flagged_item") {
            const { type, id, correctionNotes, correctedValue } = args;
            if (type === "stock_adjustment" && setAdjustments) {
              const targetAdj = adjustments.find(a => a.id === id);
              if (targetAdj) {
                setAdjustments(prev => prev.map(a => {
                  if (a.id === id) {
                    return {
                      ...a,
                      isFlagged: false,
                      isResolved: true,
                      resolvedAt: new Date().toISOString().split('T')[0],
                      resolvedBy: 'RICHARD. (AI Partner)',
                      correctionNotes: correctionNotes,
                      qtyChanged: correctedValue !== undefined ? correctedValue : a.qtyChanged
                    };
                  }
                  return a;
                }));
                
                if (correctedValue !== undefined && setInventory) {
                  setInventory(prevInv => prevInv.map(i => {
                    if (i.id === targetAdj.itemId) {
                      const reverted = i.quantity - targetAdj.qtyChanged;
                      const corrected = reverted + correctedValue;
                      return { ...i, quantity: corrected, lastUpdated: new Date().toISOString() };
                    }
                    return i;
                  }));
                }
                
                addCorrectionToast(
                  "Discrepancy Resolved",
                  `Resolved stock discrepancy for '${targetAdj.itemName}' with notes: "${correctionNotes}".`
                );
              } else {
                addCorrectionToast("Resolution Failed", `Discrepancy ID '${id}' was not found in stock logs.`);
              }
            } else if (type === "credit_transaction" && setTransactions) {
              const targetTx = transactions.find(t => t.id === id);
              if (targetTx) {
                setTransactions(prev => prev.map(t => {
                  if (t.id === id) {
                    return {
                      ...t,
                      isFlagged: false,
                      isResolved: true,
                      resolvedAt: new Date().toISOString().split('T')[0],
                      resolvedBy: 'RICHARD. (AI Partner)',
                      correctionNotes: correctionNotes,
                      amount: correctedValue !== undefined ? correctedValue : t.amount
                    };
                  }
                  return t;
                }));
                
                if (correctedValue !== undefined && setCreditAccounts) {
                  setCreditAccounts(prevAccs => prevAccs.map(acc => {
                    if (acc.id === targetTx.creditAccountId) {
                      const difference = correctedValue - targetTx.amount;
                      const finalRemaining = targetTx.type === 'pay' 
                        ? acc.remainingAmount - difference 
                        : acc.remainingAmount + difference;
                      return { ...acc, remainingAmount: Math.max(0, finalRemaining), lastUpdated: new Date().toISOString() };
                    }
                    return acc;
                  }));
                }
                
                addCorrectionToast(
                  "Discrepancy Resolved",
                  `Resolved financial ledger dispute for '${targetTx.accountName}' with notes: "${correctionNotes}".`
                );
              } else {
                addCorrectionToast("Resolution Failed", `Discrepancy ID '${id}' was not found in credit logs.`);
              }
            }
          } else if (name === "correct_dashboard_kpi") {
            const { kpiKey, newValue, reason } = args;
            if (setConfig) {
              setConfig(prev => {
                const updated = { ...prev };
                if (kpiKey === "total_inventory_value") {
                  updated.totalInventoryValueOverride = newValue;
                  updated.totalInventoryValueOverrideByAI = true;
                } else if (kpiKey === "stock_in_hand") {
                  updated.totalRetailValueOverride = newValue;
                  updated.totalRetailValueOverrideByAI = true;
                } else if (kpiKey === "value_sold_cash") {
                  updated.cashSalesValueOverride = newValue;
                  updated.cashSalesValueOverrideByAI = true;
                } else if (kpiKey === "asset_on_credit") {
                  updated.receivablesTotalOverride = newValue;
                  updated.receivablesTotalOverrideByAI = true;
                } else if (kpiKey === "total_realized_profit") {
                  updated.realizedProfitOverride = newValue;
                  updated.realizedProfitOverrideByAI = true;
                }
                return updated;
              });

              const kpiLabels: Record<string, string> = {
                total_inventory_value: "Total Inventory Value",
                stock_in_hand: "Stock in Hand",
                value_sold_cash: "Value Sold (Cash)",
                asset_on_credit: "Asset on Credit",
                total_realized_profit: "Total Realized Profit"
              };

              if (kpiLabels[kpiKey]) {
                addCorrectionToast(
                  "Dashboard KPI Overridden",
                  `Manually reset '${kpiLabels[kpiKey]}' display value to ${formatMoney(newValue)}. ${reason || ""}`
                );
              }
            }
          } else if (name === "close_voice_session") {
            disconnectVoiceSession();
            addCorrectionToast(
              "Conversation Closed",
              "AI Assistant has entered sleep mode. Wake it up by saying 'RICHARD' or clicking Start."
            );
          } else if (name === "record_credit_payment") {
            const { accountId, accountName, amount, notes } = args;
            const payVal = Math.abs(Number(amount) || 0);

            if (payVal > 0 && setCreditAccounts) {
              let targetAcc = creditAccounts.find(a => a.id === accountId);
              if (!targetAcc && accountName) {
                const lowerName = accountName.toLowerCase();
                targetAcc = creditAccounts.find(a => a.name.toLowerCase().includes(lowerName) || lowerName.includes(a.name.toLowerCase()));
              }

              if (!targetAcc) {
                addCorrectionToast(
                  "Payment Execution Failed",
                  `Could not locate credit profile matching '${accountName || accountId}'.`
                );
              } else {
                const prevRemaining = targetAcc.remainingAmount;
                const newRemaining = Math.max(0, prevRemaining - payVal);
                const newStatus = newRemaining === 0 ? 'settled' : 'partially_paid';
                const targetAccId = targetAcc.id;
                const targetAccName = targetAcc.name;

                setCreditAccounts(prevAccs => prevAccs.map(acc => {
                  if (acc.id === targetAccId) {
                    return {
                      ...acc,
                      remainingAmount: newRemaining,
                      status: newStatus,
                      lastUpdated: new Date().toISOString(),
                      paymentDate: new Date().toISOString().split('T')[0]
                    };
                  }
                  return acc;
                }));

                if (setTransactions) {
                  setTransactions(prevTx => [
                    {
                      id: 'ctx_pay_' + Math.random().toString(36).substr(2, 9),
                      creditAccountId: targetAccId,
                      accountName: targetAccName,
                      type: 'pay',
                      amount: payVal,
                      date: new Date().toISOString().split('T')[0],
                      notes: notes || 'AI Voice Executed Debt Payment',
                      performedBy: 'RICHARD. (AI Assistant)',
                      isFlagged: false,
                      isResolved: true
                    },
                    ...prevTx
                  ]);
                }

                addCorrectionToast(
                  "Credit Payment Recorded",
                  `Received ${formatMoney(payVal)} payment for '${targetAccName}'. Balance reduced from ${formatMoney(prevRemaining)} to ${formatMoney(newRemaining)}.`
                );
              }
            }
          } else if (name === "record_stock_restock") {
            const { itemId, itemName, quantity, notes } = args;
            const restockQty = Math.max(1, Number(quantity) || 1);

            if (setInventory) {
              let item = inventory.find(i => i.id === itemId);
              if (!item && itemName) {
                const lowerName = itemName.toLowerCase();
                item = inventory.find(i => i.name.toLowerCase().includes(lowerName) || lowerName.includes(i.name.toLowerCase()));
              }

              if (!item) {
                addCorrectionToast(
                  "Restock Failed",
                  `Could not locate item matching '${itemName || itemId}' in inventory.`
                );
              } else {
                const newQty = item.quantity + restockQty;
                const itemIdRestocked = item.id;
                const itemNameRestocked = item.name;

                setInventory(prevInv => prevInv.map(i => {
                  if (i.id === itemIdRestocked) {
                    return { ...i, quantity: newQty, lastUpdated: new Date().toISOString() };
                  }
                  return i;
                }));

                if (setAdjustments) {
                  setAdjustments(prevAdj => [
                    {
                      id: 'adj_restock_' + Math.random().toString(36).substr(2, 9),
                      itemId: itemIdRestocked,
                      itemName: itemNameRestocked,
                      qtyChanged: restockQty,
                      type: 'purchase_in',
                      date: new Date().toISOString().split('T')[0],
                      notes: notes || 'AI Voice Recorded Restock',
                      performedBy: 'RICHARD. (AI Assistant)',
                      isFlagged: false,
                      isResolved: true
                    },
                    ...prevAdj
                  ]);
                }

                addCorrectionToast(
                  "Stock Replenished",
                  `Added +${restockQty} units to '${itemNameRestocked}'. New stock level: ${newQty} units.`
                );
              }
            }
          } else if (name === "add_inventory_item") {
            const { name: prodName, quantity, unitCost, unitPrice, category, supplier, location } = args;
            const newQty = Math.max(0, Number(quantity) || 0);
            const cost = Math.max(0, Number(unitCost) || 0);
            const price = Math.max(0, Number(unitPrice) || 0);

            if (prodName && setInventory) {
              const newItemId = 'item_ai_' + Math.random().toString(36).substr(2, 9);
              const skuCode = 'SKU-AI-' + Math.floor(1000 + Math.random() * 9000);

              const newItem: InventoryItem = {
                id: newItemId,
                name: prodName,
                sku: skuCode,
                category: category || 'General Tech',
                quantity: newQty,
                unitCost: cost,
                unitPrice: price,
                reorderPoint: config?.lowStockThresholdDefault || 5,
                supplier: supplier || 'General Wholesaler',
                location: location || 'Main Storage',
                notes: 'Added via AI Assistant',
                lastUpdated: new Date().toISOString()
              };

              setInventory(prevInv => [newItem, ...prevInv]);

              if (newQty > 0 && setAdjustments) {
                setAdjustments(prevAdj => [
                  {
                    id: 'adj_add_' + Math.random().toString(36).substr(2, 9),
                    itemId: newItemId,
                    itemName: prodName,
                    qtyChanged: newQty,
                    type: 'purchase_in',
                    date: new Date().toISOString().split('T')[0],
                    notes: 'Initial stock on AI item catalog creation',
                    performedBy: 'RICHARD. (AI Assistant)',
                    isFlagged: false,
                    isResolved: true
                  },
                  ...prevAdj
                ]);
              }

              addCorrectionToast(
                "Product Catalog Created",
                `Registered new product '${prodName}' (${newQty} units @ ${formatMoney(price)}).`
              );
            }
          } else if (name === "create_credit_account") {
            const { name: accName, type, phone, email, initialAmount } = args;
            const initVal = Math.max(0, Number(initialAmount) || 0);

            if (accName && setCreditAccounts) {
              const newAccId = 'cred_ai_' + Math.random().toString(36).substr(2, 9);
              const today = new Date();
              const dueDate = new Date(today.setDate(today.getDate() + 30)).toISOString().split('T')[0];

              const newAcc: CreditAccount = {
                id: newAccId,
                name: accName,
                type: type === 'payable' ? 'payable' : 'receivable',
                phone: phone || '',
                email: email || '',
                totalAmount: initVal,
                remainingAmount: initVal,
                dueDate: dueDate,
                status: initVal === 0 ? 'settled' : 'active',
                notes: 'Created via AI Assistant',
                lastUpdated: new Date().toISOString(),
                dateOfCrediting: new Date().toISOString().split('T')[0]
              };

              setCreditAccounts(prevAccs => [newAcc, ...prevAccs]);

              if (initVal > 0 && setTransactions) {
                setTransactions(prevTx => [
                  {
                    id: 'ctx_init_' + Math.random().toString(36).substr(2, 9),
                    creditAccountId: newAccId,
                    accountName: accName,
                    type: 'charge',
                    amount: initVal,
                    date: new Date().toISOString().split('T')[0],
                    notes: 'Initial account balance on creation',
                    performedBy: 'RICHARD. (AI Assistant)',
                    isFlagged: false,
                    isResolved: true
                  },
                  ...prevTx
                ]);
              }

              addCorrectionToast(
                "Credit Account Registered",
                `Created ${type === 'payable' ? 'supplier payable' : 'customer receivable'} profile for '${accName}'.`
              );
            }
          }
        } else if (msg.type === "error") {
          setVoiceError(msg.error);
          setVoiceStatus("error");
          console.error("Gemini voice error:", msg.error);
        }
      };

      ws.onerror = (err) => {
        console.error("WS Live error:", err);
        setVoiceError("Connection lost. Verify system API.");
        setVoiceStatus("error");
      };

      ws.onclose = () => {
        setIsVoiceConnected(false);
        setVoiceStatus("disconnected");
      };

    } catch (err: any) {
      console.error(err);
      setVoiceError(err.message || "No microphone permissions.");
      setVoiceStatus("error");
    }
  };

  const startMicRecording = async () => {
    try {
      // 1. Request hardware & browser echo/noise suppression constraints
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 16000 },
          channelCount: 1
        }
      });
      micStreamRef.current = stream;

      const inputAudioCtx = inputAudioCtxRef.current;
      if (!inputAudioCtx) return;

      const source = inputAudioCtx.createMediaStreamSource(stream);

      // 2. High-Pass Biquad Filter (85 Hz) - cuts low HVAC hums, fan rumbles, traffic noise
      const highPassFilter = inputAudioCtx.createBiquadFilter();
      highPassFilter.type = "highpass";
      highPassFilter.frequency.setValueAtTime(85, inputAudioCtx.currentTime);

      // 3. Low-Pass Biquad Filter (7500 Hz) - cuts high-frequency hiss, sizzle
      const lowPassFilter = inputAudioCtx.createBiquadFilter();
      lowPassFilter.type = "lowpass";
      lowPassFilter.frequency.setValueAtTime(7500, inputAudioCtx.currentTime);

      const processor = inputAudioCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      // Pipe signal: Source -> HighPass -> LowPass -> Processor -> Destination
      source.connect(highPassFilter);
      highPassFilter.connect(lowPassFilter);
      lowPassFilter.connect(processor);
      processor.connect(inputAudioCtx.destination);

      let frameCounter = 0;

      processor.onaudioprocess = (e) => {
        if (isMuted || wsRef.current?.readyState !== WebSocket.OPEN) return;

        const channelData = e.inputBuffer.getChannelData(0);

        if (noiseCancellationRef.current) {
          // Calculate RMS (Root Mean Square) energy of the audio chunk
          let sum = 0;
          for (let i = 0; i < channelData.length; i++) {
            sum += channelData[i] * channelData[i];
          }
          const rms = Math.sqrt(sum / channelData.length);

          frameCounter++;
          if (frameCounter % 3 === 0) {
            setCurrentRms(rms);
          }

          const threshold = noiseGateThresholdRef.current;

          if (rms < threshold) {
            // Noise Gate Active: Silence background room noise below threshold
            setIsNoiseGateActive(true);
            for (let i = 0; i < channelData.length; i++) {
              channelData[i] = 0;
            }
          } else {
            // Command Voice detected above ambient noise floor
            setIsNoiseGateActive(false);
          }
        } else {
          setIsNoiseGateActive(false);
        }

        const pcmBuffer = floatTo16BitPCM(channelData);
        const base64PCM = arrayBufferToBase64(pcmBuffer);

        wsRef.current.send(JSON.stringify({
          type: "audio",
          audio: base64PCM
        }));
      };
    } catch (err: any) {
      console.error("Mic error:", err);
      setVoiceError("Microphone access failed.");
      setVoiceStatus("error");
    }
  };

  const stopAudioPlayback = () => {
    const activeSources = activeSourceNodesRef.current.splice(0);
    for (const source of activeSources) {
      try {
        source.onended = null;
        source.stop();
      } catch {
        // A source may already have ended; stopping it is intentionally best-effort.
      }
      try {
        source.disconnect();
      } catch {
        // Ignore nodes that are already disconnected.
      }
    }

    const outputAudioCtx = outputAudioCtxRef.current;
    nextStartTimeRef.current = outputAudioCtx?.currentTime ?? 0;
  };

  const playAudioChunk = (base64PCM: string) => {
    const outputAudioCtx = outputAudioCtxRef.current;
    if (!outputAudioCtx) return;

    if (outputAudioCtx.state === "suspended") {
      outputAudioCtx.resume();
    }

    const float32Data = base64ToFloat32(base64PCM);
    const audioBuffer = outputAudioCtx.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = outputAudioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outputAudioCtx.destination);
    activeSourceNodesRef.current.push(source);

    const currentTime = outputAudioCtx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
      nextStartTimeRef.current = currentTime + 0.04;
    }

    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;

    source.onended = () => {
      activeSourceNodesRef.current = activeSourceNodesRef.current.filter(node => node !== source);
      try {
        source.disconnect();
      } catch {
        // Ignore nodes that are already disconnected.
      }
      if (outputAudioCtx.currentTime >= nextStartTimeRef.current - 0.05) {
        setVoiceStatus("listening");
      }
    };
  };

  const disconnectVoiceSession = () => {
    stopAudioPlayback();
    setIsNoiseGateActive(false);
    setCurrentRms(0);

    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close();
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close();
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsVoiceConnected(false);
    setVoiceStatus("disconnected");
  };

  const toggleVoiceSession = () => {
    if (isVoiceConnected || voiceStatus === "connecting") {
      disconnectVoiceSession();
    } else {
      connectVoiceSession();
    }
  };

  // Helper conversions
  function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
  }

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  function base64ToFloat32(base64: string): Float32Array {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  }

  return (
    <>
      {/* 1. AUTO-WAKE FLOATING NOTIFICATION BANNER */}
      <AnimatePresence>
        {showWakePrompt && !isPanelOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 80, opacity: 0, scale: 0.95 }}
            className="fixed bottom-24 right-6 left-6 md:left-auto md:w-96 z-50 no-print"
          >
            <div className="neumorphic-card bg-[#ebf0f7] dark:bg-[#2b2d31] border border-white/90 dark:border-white/10 rounded-2xl p-4.5 shadow-2xl relative overflow-hidden flex flex-col gap-3.5">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
              
              <div className="flex items-start gap-3 relative z-10">
                <div className="w-10 h-10 neumorphic-circle bg-[#ebf0f7] dark:bg-[#202225] text-blue-600 dark:text-sky-400 rounded-xl flex items-center justify-center shrink-0">
                  <Volume2 size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white">
                    <span>Weekly report ready</span>
                  </h4>
                  <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                    Weekly insight ready
                  </p>
                </div>
              </div>

              <div className="flex gap-2 relative z-10 self-end">
                <button
                  type="button"
                  onClick={() => setShowWakePrompt(false)}
                  className="neumorphic-btn px-4 py-2 text-xs font-extrabold text-slate-800 dark:text-slate-200 hover:text-black dark:hover:text-white rounded-full transition cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPanelOpen(true);
                    setActiveTab("speech");
                    // Delay slightly to allow the panel transition, then play!
                    setTimeout(() => speakBriefing(), 300);
                  }}
                  className="neumorphic-inset bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-black text-xs px-4.5 py-2 rounded-full cursor-pointer flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98] transition"
                >
                  <Play size={11} className="fill-white" />
                  <span>Wake Up & Listen</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. FLOATING SIRI-STYLE ORB LAUNCHER */}
      <div className="fixed bottom-6 right-6 z-50 no-print" id="floating-siri-launcher">
        <div className="relative flex items-center justify-center">
          
          {/* Continuous Ambient Breathing Glow Aura (Shows Active AI State) */}
          <motion.div
            animate={{
              scale: [1, 1.18, 1],
              opacity: [0.35, 0.75, 0.35],
              boxShadow: [
                "0 0 15px rgba(56, 189, 248, 0.25)",
                "0 0 35px rgba(56, 189, 248, 0.65)",
                "0 0 15px rgba(56, 189, 248, 0.25)"
              ]
            }}
            transition={{
              duration: 3.2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -inset-2.5 rounded-full bg-gradient-to-tr from-sky-500/30 via-emerald-400/25 to-indigo-500/30 blur-md pointer-events-none z-10"
          />

          <AnimatePresence>
            {(isVoiceConnected || isSpeakingBriefing) && (
              <>
                <motion.span 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ 
                    scale: (voiceStatus === "speaking" || isSpeakingBriefing) ? [1, 1.8, 1] : [1, 1.3, 1], 
                    opacity: (voiceStatus === "speaking" || isSpeakingBriefing) ? [0.65, 0.15, 0.65] : [0.4, 0.1, 0.4] 
                  }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: (voiceStatus === "speaking" || isSpeakingBriefing) ? 1.4 : 2.2 }}
                  className={`absolute -inset-4 rounded-full pointer-events-none ${
                    (voiceStatus === "speaking" || isSpeakingBriefing) 
                      ? "bg-gradient-to-tr from-purple-500 via-pink-500 to-rose-400" 
                      : "bg-emerald-500/30"
                  }`}
                />
                <motion.span 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ 
                    scale: (voiceStatus === "speaking" || isSpeakingBriefing) ? [1, 2.3, 1] : [1, 1.5, 1], 
                    opacity: (voiceStatus === "speaking" || isSpeakingBriefing) ? [0.45, 0.05, 0.45] : [0.25, 0.05, 0.25] 
                  }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: (voiceStatus === "speaking" || isSpeakingBriefing) ? 1.7 : 2.8, delay: 0.3 }}
                  className={`absolute -inset-8 rounded-full pointer-events-none ${
                    (voiceStatus === "speaking" || isSpeakingBriefing) 
                      ? "bg-gradient-to-tr from-indigo-500 to-cyan-400" 
                      : "bg-emerald-400/15"
                  }`}
                />
              </>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVoiceSession}
            title={isWakeWordListening ? "AI Assistant (Say 'RICHARD' to wake up)" : "Start AI Voice Conversation"}
            className="h-14 w-14 !rounded-full neumorphic-card neumorphic-circle shadow-2xl flex items-center justify-center text-white cursor-pointer relative z-20 border-2 border-white/80 dark:border-slate-700/80 transition-all select-none bg-slate-900 dark:bg-[#1a1c1e]"
          >
            {voiceStatus === "connecting" ? (
              <RefreshCw size={24} className="animate-spin text-indigo-400" />
            ) : voiceStatus === "error" ? (
              <AlertCircle size={26} className="text-white" />
            ) : isVoiceConnected ? (
              <X size={26} className="text-emerald-400" />
            ) : isSpeakingBriefing ? (
              <X size={26} className="text-pink-400" />
            ) : (
              <div className="absolute inset-1 rounded-full neumorphic-inset flex items-center justify-center border border-white/20 dark:border-slate-700/30 shadow-inner bg-slate-950/90 dark:bg-[#18191c]">
                {/* Large 34px High-Contrast Google Gemini Sparkle Star with Gentle Breathing Scale */}
                <motion.svg 
                  animate={{ scale: [0.94, 1.08, 0.94] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                  width="34" 
                  height="34" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="relative z-10 shrink-0 filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                >
                  <defs>
                    <linearGradient id="geminiStarGradMain" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ff4d4d" />
                      <stop offset="33%" stopColor="#ffb800" />
                      <stop offset="66%" stopColor="#00e676" />
                      <stop offset="100%" stopColor="#2979ff" />
                    </linearGradient>
                  </defs>
                  <path 
                    d="M12 0C12 6.62742 6.62742 12 0 12C6.62742 12 12 17.3726 12 24C12 17.3726 17.3726 12 24 12C17.3726 12 12 6.62742 12 0Z" 
                    fill="url(#geminiStarGradMain)" 
                  />
                </motion.svg>
              </div>
            )}
          </motion.button>
        </div>
      </div>

      {/* 3. SLIDE-OUT AI INTELLIGENCE COMMAND PANEL */}
      <AnimatePresence>
        {isPanelOpen && (
          <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/60 no-print" onClick={closePanel}>
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking panel
              className="w-full max-w-md h-full bg-slate-950 border-l border-slate-900 shadow-2xl flex flex-col overflow-hidden text-slate-100"
            >
              {/* Panel Header */}
              <div className="p-4 border-b border-slate-900 bg-slate-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                    <Sparkles size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                      AI Command Center
                    </h3>
                    <p className="text-[10px] text-slate-400">Business Health Audit & Speech Engine</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closePanel}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Custom Tabs Navigation */}
              <div className="px-4 py-2 bg-slate-950 border-b border-slate-900 flex gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("health")}
                  className={`flex-1 py-1.5 rounded-lg text-center text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "health" 
                      ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Briefcase size={13} />
                  <span>Health Score</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("speech")}
                  className={`flex-1 py-1.5 rounded-lg text-center text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "speech" 
                      ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Volume2 size={13} />
                  <span>Closing speech</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("live")}
                  className={`flex-1 py-1.5 rounded-lg text-center text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "live" 
                      ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/20" 
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Phone size={13} />
                  <span>Live Call</span>
                </button>
              </div>

              {/* Panel Core Content (Scrollable) */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">

                {/* TAB 1: BUSINESS HEALTH AUDIT (MOVED FROM DASHBOARD) */}
                {activeTab === "health" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Dark Premium Score Gauge Card */}
                    <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-5 shadow-inner flex flex-col items-center text-center relative overflow-hidden">
                      <div className="absolute top-3 right-3">
                        <span className="text-[8px] font-bold text-indigo-500 bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-900/40">
                          DIAGNOSTIC MODULE
                        </span>
                      </div>

                      {/* Large Circular Gauge */}
                      <div className="relative w-28 h-28 shrink-0 flex items-center justify-center my-2">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="56"
                            cy="56"
                            r="45"
                            className="stroke-slate-800"
                            strokeWidth="8"
                            fill="none"
                          />
                          <circle
                            cx="56"
                            cy="56"
                            r="45"
                            className={`transition-all duration-1000 ${
                              healthMetrics.finalScore >= 90
                                ? 'stroke-emerald-500'
                                : healthMetrics.finalScore >= 75
                                ? 'stroke-indigo-500'
                                : healthMetrics.finalScore >= 50
                                ? 'stroke-amber-500'
                                : 'stroke-rose-500'
                            }`}
                            strokeWidth="8"
                            strokeDasharray={2 * Math.PI * 45}
                            strokeDashoffset={(1 - healthMetrics.finalScore / 100) * (2 * Math.PI * 45)}
                            strokeLinecap="round"
                            fill="none"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center text-center">
                          <span className="text-3xl font-black text-white leading-none">
                            {healthMetrics.finalScore}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            OVERALL
                          </span>
                        </div>
                      </div>

                      <div className="mt-2">
                        <h4 className="text-xs font-bold text-slate-300">Composite Health Index</h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Calculated in real-time across ledger modules</p>
                      </div>
                    </div>

                    {/* AI generated Commentary Section */}
                    <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles size={13} className="text-indigo-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                            AI Advisory Analysis
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={fetchHealthExplanation}
                          disabled={loadingHealth}
                          className="p-1 px-2 text-[9px] font-bold bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-400 hover:text-indigo-300 rounded-lg border border-indigo-900/40 flex items-center gap-1 transition cursor-pointer"
                        >
                          <RefreshCw size={10} className={loadingHealth ? "animate-spin" : ""} />
                          <span>Refresh Advice</span>
                        </button>
                      </div>

                      <div className="min-h-[40px] flex items-center">
                        {loadingHealth ? (
                          <div className="w-full flex items-center gap-2 py-1 justify-center">
                            <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce" />
                            <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                            <span className="text-[10px] text-slate-400 italic">Consulting RICHARD AI expert agent...</span>
                          </div>
                        ) : (
                          <p className="text-xs font-medium text-slate-200 leading-relaxed italic border-l-2 border-indigo-500/40 pl-3 py-0.5">
                            "{healthExplanation}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Subscores breakdown pills */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Score Breakdown</h4>
                      
                      {/* Stock Levels Pill */}
                      <div className="bg-slate-900/50 border border-slate-900 rounded-xl p-3 flex items-center justify-between hover:border-slate-800 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 bg-slate-800/60 rounded-lg text-slate-400">
                            <Layers size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-300 block leading-tight">Stock Buffer Safety</span>
                            <span className="text-[9px] text-slate-500 block truncate mt-0.5">
                              {healthMetrics.outOfStockCount} out of stock • {healthMetrics.lowStockCount} low
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${
                          healthMetrics.inventoryScore >= 90
                            ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40'
                            : healthMetrics.inventoryScore >= 70
                            ? 'bg-indigo-950/30 text-indigo-400 border-indigo-900/40'
                            : 'bg-rose-950/30 text-rose-400 border-rose-900/40'
                        }`}>
                          {Math.round(healthMetrics.inventoryScore)}
                        </span>
                      </div>

                      {/* Debtor Risk Pill */}
                      <div className="bg-slate-900/50 border border-slate-900 rounded-xl p-3 flex items-center justify-between hover:border-slate-800 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 bg-slate-800/60 rounded-lg text-slate-400">
                            <Users size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-300 block leading-tight">Customer Credit Security</span>
                            <span className="text-[9px] text-slate-500 block truncate mt-0.5">
                              {healthMetrics.highOrCriticalRiskCount} accounts overdue or high limit
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${
                          healthMetrics.creditScore >= 90
                            ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40'
                            : healthMetrics.creditScore >= 70
                            ? 'bg-indigo-950/30 text-indigo-400 border-indigo-900/40'
                            : 'bg-rose-950/30 text-rose-400 border-rose-900/40'
                        }`}>
                          {Math.round(healthMetrics.creditScore)}
                        </span>
                      </div>

                      {/* Log Integrity Pill */}
                      <div className="bg-slate-900/50 border border-slate-900 rounded-xl p-3 flex items-center justify-between hover:border-slate-800 transition">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-1.5 bg-slate-800/60 rounded-lg text-slate-400">
                            <ShieldCheck size={14} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-300 block leading-tight">Audit Log Integrity</span>
                            <span className="text-[9px] text-slate-500 block truncate mt-0.5">
                              {healthMetrics.totalUnresolved} unresolved discrepancies
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${
                          healthMetrics.discrepancyScore >= 90
                            ? 'bg-emerald-505 bg-emerald-950/30 text-emerald-400 border-emerald-900/40'
                            : healthMetrics.discrepancyScore >= 70
                            ? 'bg-indigo-950/30 text-indigo-400 border-indigo-900/40'
                            : 'bg-rose-950/30 text-rose-400 border-rose-900/40'
                        }`}>
                          {Math.round(healthMetrics.discrepancyScore)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB 2: WEEKLY CLOSING DAY SPEECH ADVISOR */}
                {activeTab === "speech" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Diagnostic Summary Control */}
                    <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-pink-500/10 text-pink-400 rounded-lg border border-pink-500/20">
                            <Volume2 size={16} />
                          </div>
                          <span className="text-xs font-bold text-white">Audio Briefing Controls</span>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          isSpeakingBriefing 
                            ? "bg-pink-950/35 text-pink-400 border-pink-900/40 animate-pulse" 
                            : "bg-slate-950 text-slate-400 border-slate-900"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSpeakingBriefing ? "bg-pink-500 animate-ping" : "bg-slate-600"}`} />
                          {isSpeakingBriefing ? "SPEAKING" : "IDLE"}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        This module synthesizes your entire inventory and customer credit balance logs into a professional, spoken advisory audit report.
                      </p>

                      <button
                        type="button"
                        onClick={speakBriefing}
                        className={`w-full py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
                          isSpeakingBriefing
                            ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
                            : "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-95 text-white shadow-indigo-600/20"
                        }`}
                      >
                        {isSpeakingBriefing ? (
                          <>
                            <VolumeX size={15} />
                            <span>Stop Speaking Briefing</span>
                          </>
                        ) : (
                          <>
                            <Volume2 size={15} />
                            <span>🔊 Play Weekly Speech Report Now</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Speech Advisor Scheduler Settings */}
                    <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                        <Calendar size={14} className="text-indigo-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                          Automated Closing Day Setup
                        </span>
                      </div>

                      {/* Dropdown for closing day selection */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-0.5">
                          Closing Day of Each Week
                        </label>
                        <div className="relative">
                          <select
                            value={closingDay}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setClosingDay(val);
                              localStorage.setItem("velo_ai_closing_day", val.toString());
                              
                              // Clear spoke date when date setup is modified to allow fresh tests
                              localStorage.removeItem('velo_ai_last_spoken_date');
                            }}
                            className="w-full bg-slate-950 border border-slate-850 rounded-xl py-2.5 pl-3 pr-10 text-xs text-white focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer font-medium"
                          >
                            {DAYS_OF_WEEK.map((d) => (
                              <option key={d.value} value={d.value}>
                                {d.label} {currentDayNum === d.value ? "(Today)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed pl-0.5">
                          Choose a day to automatically "wake up" the speech briefing on first load. Set to <strong className="text-white font-semibold">{currentDayLabel}</strong> to trigger the test prompt immediately!
                        </p>
                      </div>

                      {/* Toggle for auto wake voice */}
                      <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                        <div className="flex flex-col gap-0.5 pr-4">
                          <span className="text-[10.5px] font-bold text-slate-200">Enable Automated Speech Wake-up</span>
                          <span className="text-[9px] text-slate-400">Trigger prompt overlay on closing day</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = !autoWakeEnabled;
                            setAutoWakeEnabled(next);
                            localStorage.setItem("velo_ai_auto_wake", next.toString());
                          }}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                            autoWakeEnabled ? "bg-indigo-600 justify-end" : "bg-slate-800 justify-start"
                          }`}
                        >
                          <motion.span layout className="w-5 h-5 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>

                      {/* Current Status Badge */}
                      <div className="bg-indigo-950/20 border border-indigo-900/30 rounded-lg p-3 text-[10px] text-slate-300 leading-relaxed flex items-center gap-2">
                        <Info size={14} className="text-indigo-400 shrink-0" />
                        <div>
                          Today is <strong className="text-white font-bold">{currentDayLabel}</strong>. Closing day scheduled on <strong className="text-white font-bold">{DAYS_OF_WEEK.find(d => d.value === closingDay)?.label}</strong>. Status:{" "}
                          <span className={currentDayNum === closingDay ? "text-emerald-400 font-bold" : "text-slate-400 font-bold"}>
                            {currentDayNum === closingDay ? "Active Today (Auto-wake active)" : "Monitoring (Waiting for closing day)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Speech Transcript Preview */}
                    <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                        Diagnostic Script Preview
                      </span>
                      <div className="bg-slate-950 border border-slate-900 rounded-lg p-2.5 h-32 overflow-y-auto text-[10.5px] font-mono text-slate-300 leading-relaxed scrollbar-thin select-all">
                        {speechScript}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* TAB 3: ORIGINAL GEMINI VOICE CALL (LIVE API) */}
                {activeTab === "live" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Live status panel */}
                    <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-5 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
                      {isVoiceConnected && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[8px] font-bold text-emerald-400 uppercase font-mono">ESTABLISHED</span>
                        </div>
                      )}
                      {!isVoiceConnected && isWakeWordListening && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-[8px] font-bold text-emerald-400 uppercase font-mono">PASSIVE WAKE ACTIVE</span>
                        </div>
                      )}

                      <div className={`p-4 rounded-full ${
                        isVoiceConnected 
                          ? voiceStatus === "speaking" 
                            ? "bg-pink-500/10 text-pink-400 border border-pink-500/20" 
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : isWakeWordListening
                          ? "bg-emerald-950/20 text-emerald-400 border border-emerald-900/35"
                          : "bg-slate-800 text-slate-400"
                      } relative`}>
                        {(isVoiceConnected || isWakeWordListening) && (
                          <span className="absolute inset-0 rounded-full bg-current opacity-10 animate-ping" />
                        )}
                        <Mic size={28} />
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-white">LERGON Live Audio Conversation</h4>
                        <p className="text-[10px] text-slate-400">Talk live to LERGON using natural voice prompts</p>
                      </div>

                      <button
                        type="button"
                        onClick={toggleVoiceSession}
                        disabled={voiceStatus === "connecting"}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition active:scale-[0.98] cursor-pointer ${
                          isVoiceConnected
                            ? "bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 hover:opacity-95 text-white"
                            : "bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 hover:opacity-95 text-white font-extrabold"
                        }`}
                      >
                        {voiceStatus === "connecting" ? "Connecting..." : isVoiceConnected ? "Disconnect Live Session" : "Start Voice Call"}
                      </button>

                      {!isVoiceConnected && isWakeWordListening && (
                        <span className="text-[9.5px] text-emerald-400 flex items-center gap-1 animate-pulse font-mono">
                          <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full"></span>
                          Say "LERGON" to wake up and talk!
                        </span>
                      )}

                      {voiceStatus === "error" && (
                        <div className="bg-rose-950/20 border border-rose-900/30 text-rose-400 text-[10px] p-2.5 rounded-lg w-full flex items-center gap-1.5">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>{voiceError || "Voice error. Verify microphone permissions."}</span>
                        </div>
                      )}
                    </div>

                    {/* Mute toggle / details */}
                    {isVoiceConnected && (
                      <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-200">Mute Microphone</span>
                          <span className="text-[9.5px] text-slate-400">Suspend sending voice frames</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMuted(!isMuted)}
                          className={`p-2 rounded-xl border transition cursor-pointer ${
                            isMuted 
                              ? "bg-rose-950/30 text-rose-400 border-rose-900/40" 
                              : "bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-900"
                          }`}
                        >
                          {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>
                      </div>
                    )}

                    {/* Background Noise Cancellation & Voice Isolation Panel */}
                    <div className="bg-slate-900/80 border border-slate-850 rounded-xl p-4 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg border ${noiseCancellationEnabled ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" : "bg-slate-800 text-slate-400 border-slate-700"}`}>
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                              Background Noise Cancellation
                              {noiseCancellationEnabled && (
                                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-bold">DSP ACTIVE</span>
                              )}
                            </h5>
                            <p className="text-[10px] text-slate-400">Filters HVAC hums, fan rumbles, & ambient chatter</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNoiseCancellationEnabled(!noiseCancellationEnabled)}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                            noiseCancellationEnabled ? "bg-emerald-600 justify-end" : "bg-slate-800 justify-start"
                          }`}
                        >
                          <motion.span layout className="w-5 h-5 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>

                      {noiseCancellationEnabled && (
                        <div className="space-y-3 pt-1 border-t border-slate-850">
                          {/* Noise Gate Sensitivity Preset */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                              <span>Acoustic Profile</span>
                              <span className="text-emerald-400 font-mono text-[9.5px]">
                                {noiseSensitivity === "low" ? "Quiet Office (0.008)" : noiseSensitivity === "high" ? "High Noise/Market (0.025)" : "Standard Business (0.015)"}
                              </span>
                            </label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { id: "low", label: "Quiet Office", desc: "Low Threshold" },
                                { id: "medium", label: "Standard", desc: "Balanced Gate" },
                                { id: "high", label: "High Noise", desc: "Aggressive Gate" }
                              ].map(p => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => setNoiseSensitivity(p.id as any)}
                                  className={`py-1.5 px-2 rounded-lg text-[10px] border font-medium text-center transition cursor-pointer ${
                                    noiseSensitivity === p.id
                                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold"
                                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                                  }`}
                                >
                                  <div>{p.label}</div>
                                  <div className="text-[8.5px] opacity-70">{p.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Real-time RMS Noise Gate Meter (When Mic Active) */}
                          {isVoiceConnected && (
                            <div className="bg-slate-950/80 border border-slate-850 rounded-lg p-2.5 space-y-1.5 font-mono">
                              <div className="flex items-center justify-between text-[9px]">
                                <span className="text-slate-400 flex items-center gap-1">
                                  {isNoiseGateActive ? (
                                    <>
                                      <ShieldCheck size={11} className="text-amber-400 animate-pulse" />
                                      <strong className="text-amber-400">NOISE GATE ACTIVE:</strong> Silencing room noise
                                    </>
                                  ) : (
                                    <>
                                      <Mic size={11} className="text-emerald-400" />
                                      <strong className="text-emerald-400">COMMAND VOICE DETECTED:</strong> Transmitting
                                    </>
                                  )}
                                </span>
                                <span className="text-slate-400">RMS: {(currentRms * 100).toFixed(1)}%</span>
                              </div>

                              {/* Level bar */}
                              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden flex relative">
                                <div
                                  className={`h-full transition-all duration-75 ${
                                    isNoiseGateActive ? "bg-amber-500/60" : "bg-emerald-400"
                                  }`}
                                  style={{ width: `${Math.min(100, currentRms * 400)}%` }}
                                />
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10"
                                  style={{ left: `${Math.min(100, (noiseSensitivity === "low" ? 0.008 : noiseSensitivity === "high" ? 0.025 : 0.015) * 400)}%` }}
                                  title="Noise Gate Threshold"
                                />
                              </div>
                            </div>
                          )}

                          <div className="text-[9px] text-slate-500 flex items-center justify-between font-mono pt-0.5">
                            <span>Hardware Echo Cancellation: ON</span>
                            <span>85Hz HPF • 7.5kHz LPF</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 space-y-2.5 text-[11px] text-slate-400 leading-relaxed">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                        Conversational & Voice Focus Tips
                      </span>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>DSP Noise Gate automatically cancels background hums and room chatter so the AI remains focused on direct commands.</li>
                        <li><strong>Sales & Transactions:</strong> Say <strong className="text-white">"Sell 2 backpacks for cash"</strong>, <strong className="text-white">"Record a credit sale of 1 keyboard to David Chen"</strong>, or <strong className="text-white">"Record a $20 payment from David Chen"</strong>.</li>
                        <li><strong>Restock & Catalog:</strong> Say <strong className="text-white">"Restock 10 Tumblers"</strong> or <strong className="text-white">"Add a product Wireless Earbuds stock 15 price 49"</strong>.</li>
                        <li><strong>Navigation & Audits:</strong> Say <strong className="text-white">"Go to inventory"</strong>, <strong className="text-white">"Correct helmet stock to 20"</strong>, or <strong className="text-white">"Set Sarah Jenkins credit to 0"</strong>.</li>
                      </ul>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Panel Footer */}
              <div className="p-4 border-t border-slate-900 bg-slate-950 text-center text-[9px] text-slate-500 font-mono">
                VELO LEDGER CO-PILOT SYSTEM • LIVE STATUS
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time AI Data Corrections Notification List */}
      <div id="ai-corrections-toast-container" className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm pointer-events-none">
        <AnimatePresence>
          {correctionsList.map(item => (
            <motion.div
              key={item.id}
              id={`ai-corr-${item.id}`}
              initial={{ x: 100, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 100, opacity: 0, scale: 0.9 }}
              className="pointer-events-auto bg-slate-900 border border-emerald-500/40 text-white rounded-xl p-4 shadow-2xl flex items-start gap-3 relative overflow-hidden"
            >
              {/* Pulse ambient bar */}
              <div id={`ai-corr-bar-${item.id}`} className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
              
              <div id={`ai-corr-icon-${item.id}`} className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0 mt-0.5 border border-emerald-500/25">
                <CheckCircle2 size={16} />
              </div>
              
              <div id={`ai-corr-text-${item.id}`} className="flex-1 min-w-0 pr-4">
                <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">{item.title}</h4>
                <p className="text-[11px] font-semibold text-slate-100 mt-0.5 leading-relaxed">{item.message}</p>
                <span className="text-[9px] font-mono text-slate-400 block mt-2">{item.timestamp}</span>
              </div>
              
              <button
                id={`ai-corr-close-${item.id}`}
                onClick={() => setCorrectionsList(prev => prev.filter(c => c.id !== item.id))}
                className="absolute top-2 right-2 p-1 text-slate-500 hover:text-white rounded transition cursor-pointer"
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
