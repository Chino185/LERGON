import React, { useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
import {
  Lock,
  Zap,
  User,
  Building2,
  KeyRound,
  Shield,
  Plus,
  Check,
  Mail,
  AlertTriangle,
  AlertCircle,
  X,
  ChevronDown,
  Globe,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Bot,
  Sparkles,
  Package,
  CreditCard,
  Wallet,
  MessageSquare,
  Store,
  Clock,
  HelpCircle,
  Activity,
  Minus,
  Sun,
  Moon,
  Play,
  Layers,
  Smartphone,
  Rocket,
  FileText,
  Sliders,
  Loader2,
  LogIn,
  RotateCw,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  InventoryItem,
  StockAdjustment,
  CreditAccount,
  CreditTransaction,
  BusinessConfig,
  Organization,
  UserRole,
  PendingRestock
} from './types';
import {
  INITIAL_BUSINESS_CONFIG,
  INITIAL_INVENTORY,
  INITIAL_ADJUSTMENTS,
  INITIAL_CREDIT_ACCOUNTS,
  INITIAL_CREDIT_TRANSACTIONS,
  getLocalState,
  saveLocalState
} from './data';
import {
  validateEmail,
  validateUsername,
  validatePassword,
  validateBusinessName,
  sanitizeInput,
  evaluatePasswordStrength,
  validateInviteCodeFormat,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  hashPassword,
  validateStockProfileInput,
  StockProfilePayload
} from './utils/securityValidation';
import PasswordValidationChecklist from './components/PasswordValidationChecklist';
import EmailValidationChecklist from './components/EmailValidationChecklist';
import { supabase } from './utils/supabaseClient';
import {
  registerUser,
  loginUser,
  logoutUser,
  sendVerificationEmail,
  resetPasswordForEmail,
  joinAttendantWithInviteCode,
  validateAttendantInvite,
  subscribeToActivityLogs,
  logActivity,
  markNotificationsAsRead,
  loadNotificationReadIds,
  updateBusinessCurrency,
  subscribeToBusinessCurrency,
  updateUserPhone,
  updateUserTheme
} from './utils/authServices';

import { saveInventoryItem, deleteInventoryItem, directAdminRestockTransaction, subscribeToInventoryItems, subscribeToStockAdjustments, submitRestockRequest, verifyRestockRequestTransaction, recordStockAdjustmentTransaction, subscribeToRestockRequests, createAttendantInvite } from './utils/inventoryServices';
import { saveCreditProfile, subscribeToCreditProfiles } from './utils/creditServices';
import { recordSaleTransaction, recordCreditSaleTransaction, recordSupplierCreditPurchaseTransaction, recordCreditChargeTransaction, recordRepaymentTransaction, subscribeToTransactions } from './utils/transactionServices';
import { saveInvoice } from './utils/invoiceServices';
import { LandingPageBackground } from './components/LandingPageBackground';
import Navigation from './components/Navigation';

import DashboardScreen from './components/DashboardScreen';
import NotificationsScreen from './components/NotificationsScreen';
import InventoryScreen from './components/InventoryScreen';
import CreditScreen from './components/CreditScreen';
import TransactionsScreen from './components/TransactionsScreen';
import ReportScreen from './components/ReportScreen';
import SettingsScreen from './components/SettingsScreen';
import InvoiceGeneratorScreen from './components/InvoiceGeneratorScreen';
import ActivityLogScreen from './components/ActivityLogScreen';
import GeminiAssistantOverlay from './components/GeminiAssistantOverlay';
import { RichardLogo } from './components/RichardLogo';
import { CurrencyProvider } from './context/CurrencyContext';

const GeminiSparkleLogo: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = "" }) => (
  <div style={{ width: size, height: size }} className={`inline-block ${className}`} />
);

const CONFIG_KEY = 'velo_ic_config';
const INVENTORY_KEY = 'velo_ic_inventory';
const ADJUSTMENTS_KEY = 'velo_ic_adjustments';
const CREDIT_ACCOUNTS_KEY = 'velo_ic_accounts';
const TRANSACTIONS_KEY = 'velo_ic_transactions';
const PENDING_RESTOCKS_KEY = 'velo_ic_pending_restocks';

const cleanPhoneForWhatsApp = (num: string): string => {
  return num.replace(/\D/g, ''); // Removes all non-numeric characters
};

export default function App() {
  const [activeScreen, setActiveScreen] = useState<string>('dashboard');
  const [initialOpenAddModal, setInitialOpenAddModal] = useState<boolean>(false);
  const [landingBg, setLandingBg] = useState<'cloudinary_video' | 'dark_portal' | 'twilight_cyber'>('cloudinary_video');

  // --- Login wizard states ---
  const [newOrgAdminEmail, setNewOrgAdminEmail] = useState('');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgAdminPass, setNewOrgAdminPass] = useState('');

  // --- Dynamic multi-tenant organization state ---
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentUserUid, setCurrentUserUid] = useState<string>('');
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);

  // --- Landing Page & Auth Modal States ---
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [activeFaqIndex, setActiveFaqIndex] = useState<number | null>(null);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const [isLandingDark, setIsLandingDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
    }
    return false;
  });

  const toggleLandingDark = () => {
    const nextMode = !isLandingDark;
    setIsLandingDark(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  };


  // --- Track Scroll Position for Scroll-to-Top Button ---
  useEffect(() => {
    if (isLoggedIn) return;
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoggedIn]);

  // --- Synchronize Dark Mode for Landing Page & App ---
  useEffect(() => {
    if (!isLoggedIn) {
      if (isLandingDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }, [isLandingDark, isLoggedIn]);

  // --- Parallax Float Animation Logic (GSAP) ---
  useEffect(() => {
    if (isLoggedIn) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.parallax-fast').forEach((elem) => {
        gsap.to(elem, {
          y: -80,
          ease: 'none',
          scrollTrigger: {
            trigger: elem,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          }
        });
      });

      gsap.utils.toArray<HTMLElement>('.parallax-slow').forEach((elem) => {
        gsap.to(elem, {
          y: -30,
          ease: 'none',
          scrollTrigger: {
            trigger: elem,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          }
        });
      });
    });

    return () => ctx.revert();
  }, [isLoggedIn]);
  const [passcode, setPasscode] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginUsername, setLoginUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeView, setActiveView] = useState<'signin' | 'register' | 'forgot' | 'join' | 'attendant_set_password' | 'verify_email'>('signin');
  const [success, setSuccess] = useState<string | null>(null);
  const [isRegLoading, setIsRegLoading] = useState<boolean>(false);
  const [regLoadingText, setRegLoadingText] = useState<string>('Registering Business...');

  // --- Email OTP Verification States ---
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [pendingVerifyOrg, setPendingVerifyOrg] = useState<Organization | null>(null);
  const [pendingVerifyRole, setPendingVerifyRole] = useState<UserRole | null>(null);
  const [emailOtpCodeInput, setEmailOtpCodeInput] = useState('');
  const [emailOtpError, setEmailOtpError] = useState('');
  const [emailOtpSuccess, setEmailOtpSuccess] = useState('');
  const [resendOtpCountdown, setResendOtpCountdown] = useState<number>(60);
  const [isResendOtpDisabled, setIsResendOtpDisabled] = useState<boolean>(true);

  // Countdown timer for email OTP resend
  useEffect(() => {
    let timer: any;
    if (isResendOtpDisabled && resendOtpCountdown > 0) {
      timer = setInterval(() => {
        setResendOtpCountdown(prev => {
          if (prev <= 1) {
            setIsResendOtpDisabled(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isResendOtpDisabled, resendOtpCountdown]);


  // --- Attendant Join & Set Password States ---
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joinError, setJoinError] = useState('');
  const [validatedJoinOrg, setValidatedJoinOrg] = useState<Organization | null>(null);
  const [attendantEmail, setAttendantEmail] = useState('');
  const [attendantPassword, setAttendantPassword] = useState('');
  const [attendantConfirmPassword, setAttendantConfirmPassword] = useState('');
  const [showAttendantPassword, setShowAttendantPassword] = useState(false);
  const [showAttendantConfirmPassword, setShowAttendantConfirmPassword] = useState(false);
  const [attendantPasswordError, setAttendantPasswordError] = useState('');

  // --- Register/Validation states ---
  const [registerError, setRegisterError] = useState('');
  const [tempPasscodeError, setTempPasscodeError] = useState('');
  const [isLoginEmailFocused, setIsLoginEmailFocused] = useState(false);
  const [isRegEmailFocused, setIsRegEmailFocused] = useState(false);
  const [isAttendantEmailFocused, setIsAttendantEmailFocused] = useState(false);
  const [isRegPassFocused, setIsRegPassFocused] = useState(false);
  const [isAttendantPassFocused, setIsAttendantPassFocused] = useState(false);

  // --- Forgot Passcode states ---
  const [forgotOrgId, setForgotOrgId] = useState('');
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotError, setForgotError] = useState('');

  // --- Code Verification Modal states ---
  const [showCodeVerificationModal, setShowCodeVerificationModal] = useState(false);
  const [verificationOrgId, setVerificationOrgId] = useState('');
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationSuccess, setVerificationSuccess] = useState('');
  const [timeRemainingText, setTimeRemainingText] = useState('05:00');
  const [resendCooldown, setResendCooldown] = useState(300);
  const [settingsTabOverride, setSettingsTabOverride] = useState<'profile' | 'system' | 'security' | null>(null);
  const [inventoryTabOverride, setInventoryTabOverride] = useState<'active_stock' | 'damaged_audit' | 'restock_validations' | null>(null);

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');

    if (!forgotOrgId) {
      setForgotError('Please select your organization.');
      return;
    }

    const usernameCheck = validateUsername(forgotUsername);
    if (!usernameCheck.isValid) {
      setForgotError(usernameCheck.error || 'Please specify a valid attendant username.');
      return;
    }

    const targetOrg = organizations.find(o => o.id === forgotOrgId);
    if (!targetOrg) {
      setForgotError('Selected organization not found.');
      return;
    }

    const expectedUsername = (targetOrg.attendantName || 'Attendant').trim().toLowerCase();
    const enteredUsername = usernameCheck.cleanUsername.toLowerCase();

    if (enteredUsername !== expectedUsername) {
      setForgotError(`Invalid Attendant Username for this organization. (Hint: Default is "Samuel Zar" or "Attendant" if not customized)`);
      return;
    }

    const capturedUserEmail = 'zarsamuel105@gmail.com';
    const isExistingValidRequest = !!(
      targetOrg.attendantResetRequested &&
      targetOrg.attendantResetTimestamp &&
      (Date.now() - targetOrg.attendantResetTimestamp < 5 * 60 * 1000)
    );

    const requestTimestamp = isExistingValidRequest && targetOrg.attendantResetTimestamp
      ? targetOrg.attendantResetTimestamp
      : Date.now();

    const generatedPIN = Math.floor(100000 + Math.random() * 900000).toString();

    // Find and update the organization
    const updatedOrgs = organizations.map(org => {
      if (org.id === forgotOrgId) {
        if (isExistingValidRequest) {
          // Keep the existing organization state (preserving the original timestamp and the current attendantPass/PIN)
          return org;
        }
        return {
          ...org,
          attendantResetRequested: true,
          attendantResetEmail: capturedUserEmail,
          attendantResetUsername: forgotUsername.trim(),
          attendantResetTimestamp: requestTimestamp,
          previousAttendantPass: org.attendantPass,
          // Generate a real temporary 6-digit PIN for authentication
          attendantPass: generatedPIN
        };
      }
      return org;
    });

    setOrganizations(updatedOrgs);

    setVerificationOrgId(forgotOrgId);
    setVerificationCodeInput('');
    setVerificationError('');
    setVerificationSuccess('');
    setShowCodeVerificationModal(true);

    setForgotUsername('');
  };

  const getOrgStorageKey = (baseKey: string, orgId: string) => {
    if (orgId === 'default') return baseKey;
    return `${baseKey}_org_${orgId}`;
  };

  const getUserPrefStorageKey = (orgId: string, role: UserRole | null) => {
    const roleTag = role === 2 ? 'admin' : role === 5 ? 'attendant' : 'guest';
    return `velo_ic_user_prefs_org_${orgId}_role_${roleTag}`;
  };

  const loadEffectiveConfig = (orgId: string, role: UserRole | null, orgList?: Organization[]): BusinessConfig => {
    const activeList = orgList || organizations;
    const currentOrg = activeList.find(o => o.id === orgId);

    const orgConfig = getLocalState<BusinessConfig>(getOrgStorageKey(CONFIG_KEY, orgId), {
      ...INITIAL_BUSINESS_CONFIG,
      businessName: currentOrg?.name || '',
      email: role === 5 ? (currentOrg?.attendantEmail || '') : (currentOrg?.adminEmail || '')
    });

    const registeredEmail = role === 5 ? currentOrg?.attendantEmail : currentOrg?.adminEmail;
    if (registeredEmail && (!orgConfig.email || orgConfig.email !== registeredEmail)) {
      orgConfig.email = registeredEmail;
    }

    if (currentOrg?.name && orgConfig.businessName !== currentOrg.name) {
      orgConfig.businessName = currentOrg.name;
    }

    const userPrefKey = getUserPrefStorageKey(orgId, role);
    const userPrefs = getLocalState<{
      currency?: string;
      currencySymbol?: string;
      languageCode?: string;
      themeMode?: 'light' | 'dark' | 'system';
    } | null>(userPrefKey, null);

    if (!userPrefs) {
      return orgConfig;
    }

    return {
      ...orgConfig,
      currency: userPrefs.currency !== undefined ? userPrefs.currency : orgConfig.currency,
      currencySymbol: userPrefs.currencySymbol !== undefined ? userPrefs.currencySymbol : orgConfig.currencySymbol,
      languageCode: userPrefs.languageCode !== undefined ? userPrefs.languageCode : orgConfig.languageCode,
      themeMode: userPrefs.themeMode !== undefined ? userPrefs.themeMode : orgConfig.themeMode
    };
  };

  const handleLoginSubmit = async (enteredEmail: string, enteredPass: string) => {
    // 1. Check Rate Limiter (5 attempts per 1 minute)
    const rateCheck = checkRateLimit('signin_attempts', 5, 60000);
    if (rateCheck.isLocked) {
      setLoginError(`Too many failed attempts. Security lockout active for ${rateCheck.remainingSec} seconds.`);
      return;
    }

    const emailCheck = validateEmail(enteredEmail);
    if (!emailCheck.isValid) {
      recordFailedAttempt('signin_attempts', 5, 60000);
      setLoginError(emailCheck.error || 'Please supply a valid Email Address.');
      return;
    }
    const cleanEmail = emailCheck.cleanEmail;

    const passCheck = validatePassword(enteredPass, { minLength: 1 });
    if (!passCheck.isValid) {
      recordFailedAttempt('signin_attempts', 5, 60000);
      setLoginError('Incorrect email or password.');
      return;
    }
    const cleanPass = passCheck.cleanPassword;

    // 2. Execute Supabase Authentication login
    const loginRes = await loginUser(cleanEmail, cleanPass);
    if (!loginRes.success) {
      setLoginError(loginRes.error || 'Incorrect email or password.');
      return;
    }

    // 3. Instant Multi-tenant organization & role resolution
    let resolvedOrg = organizations.find(o =>
      (o.adminEmail && o.adminEmail.toLowerCase() === cleanEmail) ||
      (o.attendantEmail && o.attendantEmail.toLowerCase() === cleanEmail)
    );
    let resolvedRole: UserRole = 2; // Default Admin

    if (!resolvedOrg) {
      resolvedOrg = {
        id: `org-${cleanEmail.replace(/[^a-z0-9]/gi, '')}`,
        name: cleanEmail.split('@')[0].toUpperCase(),
        adminEmail: cleanEmail,
        adminPass: '',
        attendantPass: '',
        adminName: cleanEmail.split('@')[0],
        attendantName: 'Attendant'
      };
      setOrganizations(prev => [...prev, resolvedOrg!]);
    } else if (resolvedOrg.attendantEmail && resolvedOrg.attendantEmail.toLowerCase() === cleanEmail) {
      resolvedRole = 5;
    }

    // Success login -> reset rate limit
    resetRateLimit('signin_attempts');

    setShowAuthModal(false);
    setIsDataLoading(false);

    setLoginError('');
    setPasscode('');
  };

  const handleLogout = async () => {
    setShowAuthModal(false);
    setLoginEmail('');
    setPasscode('');
    setPendingVerifyEmail('');
    setLoginError('');
    setForgotError('');
    setRegisterError('');
    setJoinError('');
    setEmailOtpError('');
    setEmailOtpSuccess('');
    setSuccess(null);
    setActiveView('signin');
    setActiveScreen('dashboard');
    await logoutUser();
  };

  // --- Core States ---
  const [config, setConfig] = useState<BusinessConfig>(() => loadEffectiveConfig('', null));

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<CreditAccount[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [pendingRestocks, setPendingRestocks] = useState<PendingRestock[]>([]);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(true);

  // Keep track of the item IDs that have already been notified (opened in WhatsApp) in this session / localStorage
  // This prevents the browser from repeatedly spamming WhatsApp tabs on every single state render or on reload.
  const [notifiedShortageIds, setNotifiedShortageIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('velo_ic_notified_shortages');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // --- Auto-generate and Dispatch WhatsApp Shortages Message ---
  useEffect(() => {
    const lowStockItems = inventory.filter(item => item.quantity <= item.reorderPoint);

    // If some items in notifiedShortageIds are NO LONGER in lowStockItems, remove them from notifiedShortageIds
    // so they can be triggered again if they fall low in the future (restocked then went low again)
    const activeShortageIds = lowStockItems.map(item => item.id);
    const staleNotifiedIds = notifiedShortageIds.filter(id => !activeShortageIds.includes(id));

    if (staleNotifiedIds.length > 0) {
      const filtered = notifiedShortageIds.filter(id => activeShortageIds.includes(id));
      setNotifiedShortageIds(filtered);
      localStorage.setItem('velo_ic_notified_shortages', JSON.stringify(filtered));
      return;
    }

    if (lowStockItems.length === 0) return;

    // Filter to find items that have NOT been notified yet
    const unnotifiedItems = lowStockItems.filter(item => !notifiedShortageIds.includes(item.id));
    if (unnotifiedItems.length === 0) return;

    // Update state & localStorage first to avoid double execution in React 18 StrictMode
    const updatedNotifiedIds = [...notifiedShortageIds, ...unnotifiedItems.map(item => item.id)];
    setNotifiedShortageIds(updatedNotifiedIds);
    localStorage.setItem('velo_ic_notified_shortages', JSON.stringify(updatedNotifiedIds));

    // Compile shortage report
    const dateStr = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let report = `⚠️ *URGENT INVENTORY SHORTAGE DETECTED* ⚠️\n`;
    report += `*Store:* ${config.businessName}\n`;
    report += `*Date:* ${dateStr}\n\n`;
    report += `The following items have fallen low or out of stock:\n\n`;

    unnotifiedItems.forEach((item, index) => {
      report += `${index + 1}. *${item.name}*\n`;
      report += `   • SKU: ${item.sku || 'N/A'}\n`;
      report += `   • Stock: *${item.quantity} ${item.unit || 'units'}* (Reorder Point: ${item.reorderPoint})\n\n`;
    });

    report += `Please coordinate immediate restocking.\n`;
    report += `Report auto-dispatched from Velo IC terminal.`;

    // Automatically send to the configured WhatsApp numbers added (Attendant first, then Admin)
    const recipientPhone = config.attendantPhone || config.adminPhone || config.phone || '';
    const cleanPh = recipientPhone.replace(/\D/g, '');
    if (cleanPh) {
      localStorage.setItem('velo_ic_pending_whatsapp_report', report);
    }
  }, [inventory, config.businessName, config.attendantPhone, config.adminPhone, config.phone, notifiedShortageIds]);

  // AI Operational Insights States inside App.tsx
  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const [creditInsights, setCreditInsights] = useState<any>(null);
  const [loadingCreditInsights, setLoadingCreditInsights] = useState(false);
  const [creditInsightsError, setCreditInsightsError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoadingInsights(true);
    setInsightsError(null);
    try {
      const response = await fetch('/api/gemini/analyze-inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventory,
          adjustments,
          config,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch AI Insights');
      }
      const data = await response.json();
      setInsights(data);
    } catch (err: any) {
      console.error('Error fetching inventory AI insights:', err);
      setInsightsError(err.message || 'An error occurred while generating inventory insights.');
    } finally {
      setLoadingInsights(false);
    }
  };

  const fetchCreditInsights = async () => {
    setLoadingCreditInsights(true);
    setCreditInsightsError(null);
    try {
      const response = await fetch('/api/gemini/analyze-credit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          creditAccounts,
          transactions,
          config,
        }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to fetch Credit AI Insights');
      }
      const data = await response.json();
      setCreditInsights(data);
    } catch (err: any) {
      console.error('Error fetching credit AI insights:', err);
      setCreditInsightsError(err.message || 'An error occurred while generating credit risk insights.');
    } finally {
      setLoadingCreditInsights(false);
    }
  };

  const fetchAllInsights = async () => {
    await Promise.all([fetchInsights(), fetchCreditInsights()]);
  };

  // Lazy-load insights when user visits the notifications center
  useEffect(() => {
    if (activeScreen === 'notifications') {
      if (!insights && !loadingInsights) {
        fetchInsights();
      }
      if (!creditInsights && !loadingCreditInsights) {
        fetchCreditInsights();
      }
    }
  }, [activeScreen, insights, creditInsights]);

  const activeOrg = organizations.find(o => o.id === currentOrgId);
  const activeUserName = currentUserRole === 5
    ? (activeOrg?.attendantName || 'Samuel Zar')
    : (activeOrg?.adminName || config.ownerName || 'Administrator');
  const activeUserPhoto = currentUserRole === 5
    ? (activeOrg?.attendantPhoto || '')
    : (activeOrg?.adminPhoto || config.profilePhoto || '');
  const activeActorLabel = `${activeUserName} (${currentUserRole === 2 ? 'Administrator' : 'Attendant'})`;
  const labelCurrentActor = (actor?: string) => actor === currentUserUid
    ? activeActorLabel
    : (actor || 'System');

  const handleRegisterOrganization = async (email: string, name: string, adminPass: string) => {
    setRegisterError('');

    const rateCheck = checkRateLimit('signup_attempts', 5, 60000);
    if (rateCheck.isLocked) {
      setRegisterError(`Too many registration attempts. Locked out for ${rateCheck.remainingSec} seconds.`);
      return null;
    }

    if (organizations.length >= 1000) {
      setRegisterError("Registration limit reached. Please contact system support.");
      return null;
    }

    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      recordFailedAttempt('signup_attempts', 5, 60000);
      setRegisterError(emailCheck.error || "Enter a valid email address.");
      return null;
    }
    const cleanEmail = emailCheck.cleanEmail;

    const nameCheck = validateBusinessName(name);
    if (!nameCheck.isValid) {
      setRegisterError(nameCheck.error || "Business Name is invalid.");
      return null;
    }
    const cleanName = nameCheck.cleanName;

    // Duplicate business name uniqueness check (DISABLED for testing phase - will be re-enabled for production deployment)
    /*
    const remoteOrgs = await fetchOrganizations();
    const activeOrgsList = remoteOrgs || organizations;
    const isBusinessNameTaken = activeOrgsList.some(o => 
      o.name && o.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (isBusinessNameTaken) {
      recordFailedAttempt('signup_attempts', 5, 60000);
      setRegisterError("A business with this name already exists. Please choose a different business name.");
      return null;
    }
    */

    const passCheck = validatePassword(adminPass, { minLength: 8, requireComplexity: true });
    if (!passCheck.isValid) {
      setRegisterError(passCheck.error || "Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters.");
      return null;
    }
    const cleanAdminPass = passCheck.cleanPassword;

    const newOrg: Organization = {
      id: `org-${Date.now()}`,
      name: cleanName,
      adminEmail: cleanEmail,
      adminPass: cleanAdminPass,
      attendantPass: '',
      adminName: 'Administrator',
      attendantName: 'Attendant'
    };

    const updated = [...organizations, newOrg];
    setOrganizations(updated);

    // Initially configure default storage settings
    // Register auth user in Supabase Auth
    const startTime = performance.now();
    console.log('[Admin Signup] Step 1: Attempting Auth registration for:', cleanEmail);
    try {
      const authRes = await registerUser(cleanEmail, cleanAdminPass, {
        name: 'Administrator',
        role: 'admin',
        businessName: cleanName
      });

      if (!authRes.success) {
        setRegisterError(authRes.error || 'Failed to create user account in database.');
        return null;
      }

      setShowAuthModal(false);
      setRegisterError('');
      return newOrg;
    } catch (err: any) {
      console.error('SIGNUP ERROR:', err?.code, err?.message || err);
      recordFailedAttempt('signup_attempts', 5, 60000);
      const code = err?.code || '';
      let errorMsg = err?.message || 'Failed to create user account in database. Please try again.';
      if (code === 'auth/email-already-in-use') {
        errorMsg = 'An account with this email address already exists. Please sign in instead.';
      } else if (code === 'auth/weak-password') {
        errorMsg = 'Password should be at least 6 characters long.';
      } else if (code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      } else if (code === 'auth/network-request-failed') {
        errorMsg = 'Network connection error. Please check your internet connection and try again.';
      }
      setRegisterError(errorMsg);
      return null;
    }
  };

  const handleAttendantJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');

    const rateCheck = checkRateLimit('invite_pin_attempts', 5, 300000); // 5 attempts per 5 minutes
    if (rateCheck.isLocked) {
      setJoinError(`Too many failed invite code attempts. Locked for ${Math.ceil(rateCheck.remainingSec / 60)} minutes.`);
      return;
    }

    const codeCheck = validateInviteCodeFormat(inviteCodeInput);
    if (!codeCheck.isValid) {
      recordFailedAttempt('invite_pin_attempts', 5, 300000);
      setJoinError(codeCheck.error || 'Invite code must be 6 numeric digits.');
      return;
    }
    const cleanCode = codeCheck.cleanCode;

    const backendInvite = await validateAttendantInvite(cleanCode);
    const localTargetOrg = organizations.find(org => {
      const invite = org.activeInvite;
      return invite?.code === cleanCode && !invite.isUsed && Date.now() < invite.expiresAt;
    });
    const targetOrg = backendInvite.success
      ? ({
        id: backendInvite.businessId!,
        name: backendInvite.businessName || localTargetOrg?.name || 'Business',
        adminPass: '',
        attendantPass: '',
        adminEmail: localTargetOrg?.adminEmail,
        attendantName: localTargetOrg?.attendantName || 'Attendant'
      } as Organization)
      : localTargetOrg;

    if (!targetOrg) {
      const fail = recordFailedAttempt('invite_pin_attempts', 5, 300000);
      if (fail.isLocked) {
        setJoinError(`Too many failed attempts. Invite PIN verification locked for 5 minutes.`);
      } else {
        setJoinError(`Invalid or expired invite PIN code. (${fail.attemptsLeft} attempt${fail.attemptsLeft === 1 ? '' : 's'} remaining)`);
      }
      return;
    }

    resetRateLimit('invite_pin_attempts');
    setValidatedJoinOrg(targetOrg);
    setAttendantEmail('');
    setAttendantPassword('');
    setAttendantConfirmPassword('');
    setAttendantPasswordError('');
    setActiveView('attendant_set_password');
  };

  const handleAttendantSetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttendantPasswordError('');

    if (!validatedJoinOrg) {
      setJoinError('This code has expired. Ask your admin for a new one.');
      setActiveView('join');
      return;
    }

    const emailCheck = validateEmail(attendantEmail);
    if (!emailCheck.isValid) {
      setAttendantPasswordError(emailCheck.error || 'Enter a valid email address.');
      return;
    }
    const cleanEmail = emailCheck.cleanEmail;

    const isAlreadyRegistered = organizations.some(o =>
      (o.adminEmail && o.adminEmail.trim().toLowerCase() === cleanEmail) ||
      (o.attendantEmail && o.attendantEmail.trim().toLowerCase() === cleanEmail)
    );
    if (isAlreadyRegistered) {
      setAttendantPasswordError("An account with this email address already exists.");
      return;
    }

    const passCheck = validatePassword(attendantPassword, { minLength: 8, requireComplexity: true });
    if (!passCheck.isValid) {
      setAttendantPasswordError(passCheck.error || 'Password must be at least 8 characters with uppercase, lowercase, numbers, and special characters.');
      return;
    }
    const cleanPass = passCheck.cleanPassword;

    if (cleanPass !== attendantConfirmPassword.trim()) {
      setAttendantPasswordError('Passwords do not match.');
      return;
    }

    // Register attendant auth user in Supabase Auth
    console.log('[Attendant Signup] Attempting registration for:', cleanEmail, 'Business Name:', validatedJoinOrg.name);
    const authRes = await registerUser(cleanEmail, cleanPass, {
      role: 'attendant',
      name: validatedJoinOrg.name,
      inviteCode: inviteCodeInput.trim()
    });

    if (authRes.error || !authRes.user) {
      recordFailedAttempt('invite_pin_attempts', 5, 300000);
      const errorMsg = authRes.error || "Failed to create attendant account. Please try again.";
      setAttendantPasswordError(errorMsg);
      return;
    }

    // The signup trigger consumes the validated invite code and assigns the
    // attendant profile to the business before email confirmation completes.

    // Immediately sign out - Don't auto-login after Sign Up!
    await logoutUser();

    // Transition to Verify Email screen
    setPendingVerifyEmail(cleanEmail);
    setShowAuthModal(true);
    setActiveView('verify_email');
    setIsLoggedIn(false);
    setEmailOtpError('');
    setEmailOtpSuccess(`Attendant registration successful! A verification link has been sent to ${cleanEmail}. Check your email & verify, then log in.`);
  };

  const handleResendEmailOtp = async () => {
    if (isResendOtpDisabled || !pendingVerifyEmail) return;
    setEmailOtpError('');
    setEmailOtpSuccess('');

    const res = await sendVerificationEmail(pendingVerifyEmail);
    if (!res.success) {
      setEmailOtpError(res.error || 'Failed to resend verification email.');
      return;
    }

    setEmailOtpSuccess('A new verification link has been sent to your email address.');
    setIsResendOtpDisabled(true);
    setResendOtpCountdown(60);
    setTimeout(() => setEmailOtpSuccess(''), 4000);
  };

  const handleVerifyEmailOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailOtpError('');
    setEmailOtpSuccess('');

    // Supabase uses link-based email confirmation; there is no OTP code to verify.
    // Guide the user to check their email and click the confirmation link.
    setEmailOtpSuccess('Please check your email and click the confirmation link to verify your account. Once verified, sign in with your credentials.');
    setTimeout(() => {
      setShowAuthModal(true);
      setActiveView('signin');
      setPendingVerifyEmail('');
      setPendingVerifyOrg(null);
      setPendingVerifyRole(null);
      setEmailOtpCodeInput('');
    }, 3000);
  };

  // Listen for Supabase email confirmation link redirect session or errors on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorCode = hashParams.get('error_code');
      const errorDesc = hashParams.get('error_description');

      if (errorCode || errorDesc) {
        let userFriendlyMsg = 'The email link is invalid or has expired. Please sign in with your email and password.';
        if (errorCode === 'otp_expired' || (errorDesc && errorDesc.toLowerCase().includes('expired'))) {
          userFriendlyMsg = 'This email link has expired. Please sign in with your email and password.';
        }
        setLoginError(userFriendlyMsg);
        setShowAuthModal(true);
        setActiveView('signin');

        // Clean up ugly error hash fragment from URL without page reload
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }

    // Global reactive authentication listener using Supabase onAuthStateChange
    let profileChannel: any = null;

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = session.user;
        console.log('[Supabase Auth Listener] Active session for:', user.email, 'UID:', user.id);
        setIsLoggedIn(true);
        setCurrentUserUid(user.id);

        // Fetch initial profile data
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          const roleStr = profileData.role === 'admin' ? 'admin' : 'attendant';

          if (profileData.business_id) {
            const { data: businessData } = await supabase
              .from('businesses')
              .select('id, trade_name, base_country, base_currency_code, base_currency_symbol, owner_admin_id')
              .eq('id', profileData.business_id)
              .single();
            const localOrg = organizations.find(o =>
              o.id === profileData.business_id ||
              o.adminEmail?.toLowerCase() === user.email?.toLowerCase() ||
              o.attendantEmail?.toLowerCase() === user.email?.toLowerCase()
            );
            const normalizedOrg: Organization = {
              id: profileData.business_id,
              name: businessData?.trade_name || localOrg?.name || 'Business',
              adminPass: localOrg?.adminPass || '',
              attendantPass: localOrg?.attendantPass || '',
              adminEmail: roleStr === 'admin' ? (user.email || localOrg?.adminEmail) : localOrg?.adminEmail,
              attendantEmail: roleStr === 'attendant' ? (user.email || localOrg?.attendantEmail) : localOrg?.attendantEmail,
              adminName: roleStr === 'admin' ? (profileData.display_username || localOrg?.adminName || 'Administrator') : localOrg?.adminName,
              attendantName: roleStr === 'attendant' ? (profileData.display_username || localOrg?.attendantName || 'Attendant') : localOrg?.attendantName,
              adminPhoto: localOrg?.adminPhoto,
              attendantPhoto: localOrg?.attendantPhoto,
              activeInvite: localOrg?.activeInvite
            };
            setOrganizations(prev => [normalizedOrg, ...prev.filter(o => o.id !== normalizedOrg.id && o.id !== localOrg?.id)]);
            if (businessData) {
              setConfig(prev => ({
                ...prev,
                businessName: businessData.trade_name || prev.businessName,
                country: businessData.base_country || prev.country,
                currency: businessData.base_currency_code || prev.currency,
                currencySymbol: businessData.base_currency_symbol || prev.currencySymbol,
                email: roleStr === 'admin' ? (user.email || prev.email) : prev.email
              }));
            }
          }
          const roleNum: UserRole = roleStr === 'admin' ? 2 : 5;
          setCurrentUserRole(roleNum);
          setCurrentOrgId(profileData.business_id || '');

          if (profileData.account_status && profileData.account_status !== 'active') {
            logoutUser();
            setIsLoggedIn(false);
            setCurrentUserRole(null);
            setCurrentOrgId('');
            setCurrentUserUid('');
            setReadNotificationIds([]);
            return;
          }

          if (profileData.theme_preference) {
            if (profileData.theme_preference === 'dark') {
              document.documentElement.classList.add('dark');
              document.documentElement.setAttribute('data-theme', 'dark');
            } else {
              document.documentElement.classList.remove('dark');
              document.documentElement.setAttribute('data-theme', 'light');
            }
            const backendTheme = profileData.theme_preference === 'dark' ? 'dark' : 'light';
            const prefKey = getUserPrefStorageKey(profileData.business_id || '', roleStr === 'admin' ? 2 : 5);
            const existingPrefs = getLocalState<Record<string, unknown>>(prefKey, {});
            saveLocalState(prefKey, { ...existingPrefs, themeMode: backendTheme });
            setConfig(prev => ({ ...prev, themeMode: backendTheme }));
          }

          // Pull the user's own contact number back from the backend (the
          // source of truth) into local config, so it shows correctly on
          // this device/session even if it was last set somewhere else.
          if (typeof profileData.phone === 'string') {
            setConfig(prev => (
              roleStr === 'admin'
                ? { ...prev, phone: profileData.phone, adminPhone: profileData.phone }
                : { ...prev, phone: profileData.phone, attendantPhone: profileData.phone }
            ));
          }
        }

        // Subscribe to Realtime profile changes
        if (profileChannel) {
          supabase.removeChannel(profileChannel);
        }
        profileChannel = supabase
          .channel(`profile_${user.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
            (payload: any) => {
              const data = payload.new;
              if (data) {
                const roleStr = data.role === 'admin' ? 'admin' : 'attendant';
                const roleNum: UserRole = roleStr === 'admin' ? 2 : 5;
                setCurrentUserRole(roleNum);
                setCurrentOrgId(data.business_id || '');

                if (data.account_status && data.account_status !== 'active') {
                  logoutUser();
                  setIsLoggedIn(false);
                  setCurrentUserRole(null);
                  setCurrentOrgId('');
                  setCurrentUserUid('');
                  setReadNotificationIds([]);
                }

                if (data.theme_preference) {
                  if (data.theme_preference === 'dark') {
                    document.documentElement.classList.add('dark');
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.setAttribute('data-theme', 'light');
                  }
                  const backendTheme = data.theme_preference === 'dark' ? 'dark' : 'light';
                  const prefKey = getUserPrefStorageKey(data.business_id || '', roleStr === 'admin' ? 2 : 5);
                  const existingPrefs = getLocalState<Record<string, unknown>>(prefKey, {});
                  saveLocalState(prefKey, { ...existingPrefs, themeMode: backendTheme });
                  setConfig(prev => ({ ...prev, themeMode: backendTheme }));
                }

                // Keep the locally-shown contact number in sync with the
                // backend if it changes elsewhere (e.g. another device).
                if (typeof data.phone === 'string') {
                  setConfig(prev => (
                    roleStr === 'admin'
                      ? { ...prev, phone: data.phone, adminPhone: data.phone }
                      : { ...prev, phone: data.phone, attendantPhone: data.phone }
                  ));
                }
              }
            }
          )
          .subscribe();

      } else {
        console.log('[Supabase Auth Listener] User signed out or inactive.');
        setIsLoggedIn(false);
        setCurrentUserRole(null);
        setCurrentOrgId('');
        setCurrentUserUid('');
        setReadNotificationIds([]);
        if (profileChannel) {
          supabase.removeChannel(profileChannel);
          profileChannel = null;
        }
      }
    });

    return () => {
      authSubscription.unsubscribe();
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  // Restore per-user notification read state from the current tenant.
  useEffect(() => {
    if (!isLoggedIn || !currentOrgId || !currentUserUid) {
      setReadNotificationIds([]);
      return;
    }
    loadNotificationReadIds(currentUserUid, currentOrgId).then(setReadNotificationIds);
  }, [isLoggedIn, currentOrgId, currentUserUid]);

  // Sync role & screen state
  useEffect(() => {
    if (currentUserRole !== 2 && activeScreen === 'activity_log') {
      setActiveScreen('dashboard');
    }
  }, [currentUserRole, activeScreen]);

  useEffect(() => {
    if (isLoggedIn && currentOrgId) {
      const effective = loadEffectiveConfig(currentOrgId, currentUserRole, organizations);
      setConfig(effective);
    }
  }, [currentOrgId, currentUserRole, isLoggedIn, organizations]);

  // Fetch real inventory, credits, transactions, and activity logs from Cloud Firestore onSnapshot Subscriptions
  useEffect(() => {
    if (!isLoggedIn || !currentOrgId) {
      setIsDataLoading(false);
      return;
    }

    setIsDataLoading(false);

    // 1. Real-time Inventory Listener
    const unsubInventory = subscribeToInventoryItems(currentOrgId, (items) => {
      setInventory(items || []);
    });

    // 2. Real-time Credit Accounts Listener
    const unsubCredits = subscribeToCreditProfiles(currentOrgId, (accounts) => {
      setCreditAccounts(accounts || []);
    });

    // 3. Real-time Sales Transactions Listener
    const unsubSales = subscribeToTransactions(currentOrgId, (txns) => {
      setTransactions((txns || []).map(tx => ({
        ...tx,
        performedBy: labelCurrentActor(tx.performedBy)
      })));
    });

    // 4. Real-time typed stock-adjustment ledger listener
    const unsubAdjustments = subscribeToStockAdjustments(currentOrgId, (items) => {
      setAdjustments((items || []).map(adj => ({
        ...adj,
        performedBy: labelCurrentActor(adj.performedBy)
      })));
    });

    // 5. Real-time pending restock requests listener
    const unsubRestocks = subscribeToRestockRequests(currentOrgId, (requests) => {
      setPendingRestocks(requests || []);
    });

    // 6. Real-time Business Currency Listener — keeps every device (Admin
    // and Attendant) in sync the instant the Admin changes the business
    // currency, instead of waiting on next login/refresh.
    const unsubCurrency = subscribeToBusinessCurrency(currentOrgId, ({ country, currencyCode, currencySymbol }) => {
      setConfig(prev => {
        if (prev.country === country && prev.currency === currencyCode && prev.currencySymbol === currencySymbol) {
          return prev;
        }
        return {
          ...prev,
          ...(country ? { country } : {}),
          currency: currencyCode,
          currencySymbol: currencySymbol
        };
      });
    });

    return () => {
      unsubInventory();
      unsubCredits();
      unsubSales();
      unsubAdjustments();
      unsubRestocks();
      unsubCurrency();
    };
  }, [isLoggedIn, currentOrgId, currentUserUid, currentUserRole, activeUserName]);

  // Fast active session verification against Supabase Auth
  useEffect(() => {
    if (isLoggedIn && currentOrgId) {
      async function verifyActiveOrgSession() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && isLoggedIn) {
          handleLogout();
        }
      }

      verifyActiveOrgSession();
      window.addEventListener('focus', verifyActiveOrgSession);
      return () => {
        window.removeEventListener('focus', verifyActiveOrgSession);
      };
    }
  }, [isLoggedIn, currentOrgId]);

  // Business data state is populated exclusively from live Supabase Realtime listeners

  // --- Auto-restore active forgot password session on load/mount ---
  useEffect(() => {
    if (!isLoggedIn) {
      const activeResetOrg = organizations.find(org =>
        org.attendantResetRequested &&
        org.attendantResetTimestamp &&
        (Date.now() - org.attendantResetTimestamp < 5 * 60 * 1000)
      );
      if (activeResetOrg) {
        setVerificationOrgId(activeResetOrg.id);
        setShowCodeVerificationModal(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Code Verification Countdown Timer & Handler ---
  useEffect(() => {
    if (!showCodeVerificationModal || !verificationOrgId) {
      return;
    }

    const org = organizations.find(o => o.id === verificationOrgId);
    if (!org || !org.attendantResetTimestamp) {
      setTimeRemainingText('Expired');
      setResendCooldown(0);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - (org.attendantResetTimestamp || 0);
      const fiveMinutes = 5 * 60 * 1000;
      const remaining = fiveMinutes - elapsed;

      const elapsedSec = Math.floor(elapsed / 1000);
      setResendCooldown(Math.max(0, 300 - elapsedSec));

      if (remaining <= 0) {
        setTimeRemainingText('Expired');
        setVerificationError('This passcode reset window has expired. Please close this window and request a new passcode reset.');
        clearInterval(interval);
      } else {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setTimeRemainingText(formatted);
      }
    }, 1000);

    // Initial run immediately to avoid delay
    const now = Date.now();
    const elapsed = now - (org.attendantResetTimestamp || 0);
    const fiveMinutes = 5 * 60 * 1000;
    const remaining = fiveMinutes - elapsed;

    const elapsedSec = Math.floor(elapsed / 1000);
    setResendCooldown(Math.max(0, 300 - elapsedSec));

    if (remaining <= 0) {
      setTimeRemainingText('Expired');
      setVerificationError('This reset request has expired. Code must be verified within 5 minutes.');
    } else {
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      const formatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setTimeRemainingText(formatted);
    }

    return () => clearInterval(interval);
  }, [showCodeVerificationModal, verificationOrgId, organizations]);

  const handleVerifyCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');
    setVerificationSuccess('');

    const targetOrg = organizations.find(o => o.id === verificationOrgId);
    if (!targetOrg) {
      setVerificationError('Organization not found.');
      return;
    }

    if (!targetOrg.attendantResetTimestamp) {
      setVerificationError('No reset request found for this organization.');
      return;
    }

    // Check expiry
    const now = Date.now();
    const elapsed = now - targetOrg.attendantResetTimestamp;
    if (elapsed > 5 * 60 * 1000) {
      setVerificationError('This reset request has expired. Code must be verified within 5 minutes.');
      return;
    }

    if (!verificationCodeInput.trim()) {
      setVerificationError('Please enter the temporary passcode PIN.');
      return;
    }

    // Check if the input code matches the temporary passcode set by the admin!
    if (verificationCodeInput.trim() !== targetOrg.attendantPass) {
      setVerificationError('Incorrect verification PIN. Please verify the code matching what your admin has configured.');
      return;
    }

    // Success! Code matches and is valid!
    setVerificationSuccess('Verification successful! Logging you in...');

    // Clear the active reset request state
    const updatedOrgs = organizations.map(o => {
      if (o.id === targetOrg.id) {
        return {
          ...o,
          attendantResetRequested: false,
          isTempPassword: true
        };
      }
      return o;
    });
    setOrganizations(updatedOrgs);
    // Perform standard login as attendant
    setTimeout(() => {
      // Close verification modal
      setShowCodeVerificationModal(false);

      setLoginError('');
      setPasscode('');
      setVerificationCodeInput('');
      setVerificationSuccess('');
    }, 1000);
  };

  const handleResendPINClick = () => {
    const targetOrg = organizations.find(o => o.id === verificationOrgId);
    if (!targetOrg) {
      setVerificationError('Organization not found.');
      return;
    }

    const elapsed = Date.now() - (targetOrg.attendantResetTimestamp || 0);
    if (elapsed < 300 * 1000) {
      const waitRemainingSec = Math.ceil((300 * 1000 - elapsed) / 1000);
      const waitMinutes = Math.floor(waitRemainingSec / 60);
      const waitSeconds = waitRemainingSec % 60;
      const waitMsg = waitMinutes > 0
        ? `${waitMinutes}m ${waitSeconds}s`
        : `${waitSeconds}s`;
      setVerificationError(`Please wait ${waitMsg} before requesting another PIN.`);
      return;
    }

    const requestTimestamp = Date.now();
    const capturedUserEmail = 'zarsamuel105@gmail.com';
    const generatedPIN = Math.floor(100000 + Math.random() * 900000).toString();

    const updatedOrgs = organizations.map(org => {
      if (org.id === verificationOrgId) {
        return {
          ...org,
          attendantResetRequested: true,
          attendantResetEmail: capturedUserEmail,
          attendantResetTimestamp: requestTimestamp,
          previousAttendantPass: org.attendantPass,
          attendantPass: generatedPIN
        };
      }
      return org;
    });

    setOrganizations(updatedOrgs);

    setVerificationCodeInput('');
    setVerificationError('');
    setVerificationSuccess('A new temporary PIN has been requested successfully.');
    setResendCooldown(300);
  };

  // --- Handlers: Inventory ---
  const handleAddItem = async (newItemData: Omit<InventoryItem, 'id' | 'lastUpdated'>): Promise<{ success: boolean; error?: string }> => {
    const rawCost = newItemData.unitCost !== undefined ? newItemData.unitCost : (newItemData as any).costPrice;
    const rawPrice = newItemData.unitPrice !== undefined ? newItemData.unitPrice : (newItemData as any).sellingPrice;
    const rawMin = newItemData.reorderPoint !== undefined ? newItemData.reorderPoint : (newItemData as any).minStock;
    const rawNotes = newItemData.notes || (newItemData as any).remarks || '';

    const payload = {
      name: newItemData.name,
      sku: newItemData.sku,
      category: newItemData.category,
      quantity: Number(newItemData.quantity || 0),
      reorderPoint: Number(rawMin || 0),
      unitCost: Number(rawCost || 0),
      unitPrice: Number(rawPrice || 0),
      supplier: newItemData.supplier || '',
      location: newItemData.location || '',
      notes: rawNotes
    };

    const userUid = currentUserUid || '';
    const syncRes = await saveInventoryItem(currentOrgId, userUid, currentUserRole || 2, payload);

    if (!syncRes.success) {
      return { success: false, error: syncRes.error || 'Failed to save product to Cloud Firestore.' };
    }

    const freshItem: InventoryItem = {
      ...newItemData,
      id: syncRes.itemId || `item-${Date.now()}`,
      unitCost: Number(rawCost || 0),
      unitPrice: Number(rawPrice || 0),
      reorderPoint: Number(rawMin || 0),
      notes: rawNotes,
      lastUpdated: new Date().toISOString()
    };

    setInventory(prev => [freshItem, ...prev.filter(i => i.id !== freshItem.id)]);
    return { success: true };
  };

  const handleUpdateItem = async (id: string, updates: Partial<InventoryItem>) => {
    const existing = inventory.find(i => i.id === id);
    if (!existing) return;

    const merged = { ...existing, ...updates };
    const userUid = currentUserUid || '';

    const syncRes = await saveInventoryItem(currentOrgId, userUid, currentUserRole || 2, merged, id);
    if (!syncRes.success) {
      alert(`Update Failed: ${syncRes.error}`);
      return false;
    }

    setInventory(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          ...updates,
          lastUpdated: new Date().toISOString()
        };
      }
      return item;
    }));
  };

  const handleDeleteItem = async (id: string) => {
    const deleted = await deleteInventoryItem(currentOrgId, id);
    if (!deleted) {
      alert('The inventory item could not be deleted from the backend.');
      return false;
    }
    // Realtime inventory and stock-adjustment subscriptions remove the item
    // and any cascaded records from every page without a refresh.
    return true;
  };


  const handleLogAdjustment = async (
    itemId: string,
    qtyChanged: number,
    type: StockAdjustment['type'],
    notes: string,
    creditAccountId?: string,
    performedBy?: string
  ) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return { success: false, error: 'Inventory item not found.' };

    const userUid = currentUserUid || '';
    let result: { success: boolean; error?: string };

    // Attendants submit restock requests; only an approved request changes stock.
    if (currentUserRole === 5 && qtyChanged > 0 && type === 'purchase_in') {
      result = await submitRestockRequest(currentOrgId, userUid, '', currentUserRole, {
        itemId,
        itemName: item.name,
        requestedQuantity: qtyChanged,
        notes
      });
    } else if (type === 'sale_out' && creditAccountId) {
      const saleResult = await recordCreditSaleTransaction(
        currentOrgId,
        userUid,
        creditAccountId,
        itemId,
        Math.abs(qtyChanged),
        item.unitPrice || 0,
        notes,
        'manual'
      );
      result = saleResult;
    } else if (type === 'sale_out' && !creditAccountId) {
      result = await recordSaleTransaction(
        currentOrgId,
        userUid,
        itemId,
        Math.abs(qtyChanged),
        item.unitPrice || 0,
        'Cash',
        'manual'
      );
    } else {
      result = await recordStockAdjustmentTransaction(
        currentOrgId,
        userUid,
        currentUserRole || 2,
        { itemId, qtyChanged, type, notes, creditAccountId }
      );
    }

    if (!result.success) {
      alert(result.error || 'Failed to persist the stock movement.');
    }
    return result;
  };

  const handleVerifyRestock = (
    id: string,
    adminQty: number,
    discrepancyNotes?: string,
    forceResolveValue?: number
  ): 'resolved_matched' | 'on_hold' | 'resolved_forced' | 'error' => {
    const pending = pendingRestocks.find(r => r.id === id);
    if (!pending) return 'error';

    const isForced = forceResolveValue !== undefined;
    const isMatch = adminQty === pending.attendantQty;
    const status = (isForced || isMatch) ? 'approved' : 'on_hold';
    const targetQty = isForced ? Number(forceResolveValue) : adminQty;

    verifyRestockRequestTransaction(
      currentOrgId,
      currentUserUid || '',
      currentUserRole || 2,
      id,
      pending.itemId,
      pending.attendantQty,
      targetQty,
      discrepancyNotes,
      isForced ? Number(forceResolveValue) : undefined
    ).then(result => {
      if (result.result === 'error' || !result.success) {
        alert(result.error || 'Failed to persist restock verification.');
      }
    });

    if (status === 'on_hold') return 'on_hold';
    return isForced ? 'resolved_forced' : 'resolved_matched';
  };

  const handleFlagAdjustment = (id: string, comment: string) => {
    const actor = activeUserName;

    setAdjustments(prev => prev.map(adj => {
      if (adj.id === id) {
        return {
          ...adj,
          isFlagged: true,
          flagComment: comment,
          flaggedBy: actor,
          flaggedAt: new Date().toISOString()
        };
      }
      return adj;
    }));
  };

  const handleCorrectAdjustmentQty = (id: string, correctedQty: number, correctionNotes: string) => {
    const adj = adjustments.find(a => a.id === id);
    if (!adj) return;

    const item = inventory.find(i => i.id === adj.itemId);
    const difference = correctedQty - adj.qtyChanged;

    // 1. Update physical quantity count
    setInventory(prevInv => prevInv.map(i => {
      if (i.id === adj.itemId) {
        return {
          ...i,
          quantity: Math.max(0, i.quantity + difference),
          lastUpdated: new Date().toISOString()
        };
      }
      return i;
    }));

    // 2. Update CreditAccounts and Transactions if credit-linked
    if (adj.creditAccountId) {
      const adjType = adj.type;
      const unitPriceOrCost = adjType === 'sale_out' ? (item?.unitPrice || 0) : (item?.unitCost || 0);
      const creditAmountDiff = (Math.abs(adj.qtyChanged) - Math.abs(correctedQty)) * unitPriceOrCost;

      setCreditAccounts(prevAccs => prevAccs.map(acc => {
        if (acc.id === adj.creditAccountId) {
          const nextTotal = Math.max(0, acc.totalAmount - creditAmountDiff);
          const nextRemaining = Math.max(0, acc.remainingAmount - creditAmountDiff);
          return {
            ...acc,
            totalAmount: nextTotal,
            remainingAmount: nextRemaining,
            status: nextRemaining === 0 ? 'settled' : nextRemaining < nextTotal ? 'partially_paid' : 'active',
            lastUpdated: new Date().toISOString()
          };
        }
        return acc;
      }));

      setTransactions(prevTxns => prevTxns.map(tx => {
        if (tx.creditAccountId === adj.creditAccountId && tx.type === 'charge') {
          const nextAmount = Math.max(0, tx.amount - creditAmountDiff);
          return {
            ...tx,
            amount: nextAmount,
            remainingAmount: tx.remainingAmount !== undefined ? Math.max(0, tx.remainingAmount - creditAmountDiff) : nextAmount
          };
        }
        return tx;
      }));
    }

    // 3. Update Adjustments list
    setAdjustments(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          originalQtyChanged: a.qtyChanged,
          qtyChanged: correctedQty,
          isFlagged: false,
          isResolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedBy: currentUserRole === 2 ? 'Admin' : 'Attendant',
          correctionNotes,
          notes: `${a.notes ? a.notes + ' ' : ''}[Corrected from ${a.qtyChanged} to ${correctedQty}: ${correctionNotes}]`
        };
      }
      return a;
    }));
  };

  const handleFlagTransaction = (id: string, comment: string) => {
    const actor = activeUserName;

    setTransactions(prev => prev.map(tx => {
      if (tx.id === id) {
        return {
          ...tx,
          isFlagged: true,
          flagComment: comment,
          flaggedBy: actor,
          flaggedAt: new Date().toISOString()
        };
      }
      return tx;
    }));
  };

  const handleCorrectTransactionAmount = (id: string, correctedAmount: number, correctionNotes: string) => {
    const targetTx = transactions.find(t => t.id === id);
    if (!targetTx) return;

    const difference = correctedAmount - targetTx.amount;

    // 1. Update CreditAccounts state
    setCreditAccounts(prevAccs => prevAccs.map(acc => {
      if (acc.id === targetTx.creditAccountId) {
        const nowStr = new Date().toISOString();
        let nextRemaining = acc.remainingAmount;
        let nextTotalAmount = acc.totalAmount;

        if (targetTx.type === 'pay') {
          nextRemaining = Math.max(0, acc.remainingAmount - difference);
        } else if (targetTx.type === 'charge' || targetTx.type === 'borrow') {
          nextRemaining = Math.max(0, acc.remainingAmount + difference);
          nextTotalAmount = Math.max(0, acc.totalAmount + difference);
        }

        let nextStatus: CreditAccount['status'] = 'active';
        if (nextRemaining === 0) {
          nextStatus = 'settled';
        } else if (nextRemaining < nextTotalAmount && nextRemaining > 0) {
          nextStatus = 'partially_paid';
        } else if (acc.dueDate < nowStr.split('T')[0]) {
          nextStatus = 'overdue';
        }

        return {
          ...acc,
          totalAmount: nextTotalAmount,
          remainingAmount: nextRemaining,
          status: nextStatus,
          lastUpdated: nowStr
        };
      }
      return acc;
    }));

    // 2. Update Transactions state
    setTransactions(prevTxns => {
      let updatedPrev = prevTxns.map(tx => {
        if (tx.id === id) {
          return {
            ...tx,
            originalAmount: tx.amount,
            amount: correctedAmount,
            isFlagged: false,
            isResolved: true,
            resolvedAt: new Date().toISOString(),
            resolvedBy: currentUserRole === 2 ? 'Admin' : 'Attendant',
            correctionNotes,
            notes: `${tx.notes ? tx.notes + ' ' : ''}[Corrected from ${tx.amount} to ${correctedAmount}: ${correctionNotes}]`,
            ...((tx.type === 'charge' || tx.type === 'borrow') ? { remainingAmount: Math.max(0, (tx.remainingAmount ?? tx.amount) + difference) } : {})
          };
        }
        return tx;
      });

      if (targetTx.type === 'pay') {
        let outstandingToRestore = -difference;
        if (outstandingToRestore > 0) {
          updatedPrev = updatedPrev.map(t => {
            if (t.creditAccountId === targetTx.creditAccountId && (t.type === 'charge' || t.type === 'borrow') && outstandingToRestore > 0) {
              const currentRem = t.remainingAmount ?? t.amount;
              const maxPossible = t.amount - currentRem;
              const restore = Math.min(maxPossible, outstandingToRestore);
              outstandingToRestore -= restore;
              return { ...t, remainingAmount: currentRem + restore };
            }
            return t;
          });
        } else if (outstandingToRestore < 0) {
          let paymentToAllocate = -outstandingToRestore;
          updatedPrev = updatedPrev.map(t => {
            if (t.creditAccountId === targetTx.creditAccountId && (t.type === 'charge' || t.type === 'borrow') && paymentToAllocate > 0) {
              const currentRem = t.remainingAmount ?? t.amount;
              const deduct = Math.min(currentRem, paymentToAllocate);
              paymentToAllocate -= deduct;
              return { ...t, remainingAmount: currentRem - deduct };
            }
            return t;
          });
        }
      }

      return updatedPrev;
    });
  };

  // --- Handlers: Credit Ledger ---
  const handleAddAccount = async (
    newAccData: Omit<CreditAccount, 'id' | 'remainingAmount' | 'status' | 'lastUpdated'>,
    items?: Array<{ itemId: string; qty: number; unitPrice: number }>,
    performedBy?: string
  ): Promise<string | null> => {
    const actor = performedBy || activeUserName;
    const itemTotal = items?.reduce((sum, item) => {
      const inventoryItem = inventory.find(i => i.id === item.itemId);
      const unitValue = newAccData.type === 'receivable' ? item.unitPrice : (inventoryItem?.unitCost || item.unitPrice);
      return sum + item.qty * unitValue;
    }, 0) || 0;
    const initialAmount = items && items.length > 0 ? 0 : Number(newAccData.totalAmount || 0);

    const saveResult = await saveCreditProfile(currentOrgId, currentUserUid || '', {
      name: newAccData.name,
      type: newAccData.type,
      phone: newAccData.phone,
      email: newAccData.email,
      totalAmount: initialAmount,
      dueDate: newAccData.dueDate,
      notes: newAccData.notes
    });
    if (!saveResult.success || !saveResult.id) {
      alert(saveResult.error || 'Failed to save credit account.');
      return null;
    }

    const parentId = saveResult.id;
    const freshAcc: CreditAccount = {
      ...newAccData,
      id: parentId,
      totalAmount: initialAmount + itemTotal,
      remainingAmount: initialAmount + itemTotal,
      status: initialAmount + itemTotal === 0 ? 'settled' : 'active',
      lastUpdated: new Date().toISOString(),
      dateOfCrediting: new Date().toISOString(),
      paymentDate: undefined
    };

    setCreditAccounts(prev => [freshAcc, ...prev.filter(acc => acc.id !== parentId)]);

    if (items && items.length > 0) {
      for (const it of items) {
        const inventoryItem = inventory.find(i => i.id === it.itemId);
        if (!inventoryItem) continue;
        const note = newAccData.type === 'receivable'
          ? `Credited to customer ${newAccData.name} on account profile setup.`
          : `Purchased on credit from supplier ${newAccData.name} on account profile setup.`;
        const result = newAccData.type === 'receivable'
          ? await recordCreditSaleTransaction(currentOrgId, currentUserUid || '', parentId, it.itemId, it.qty, it.unitPrice, note)
          : await recordSupplierCreditPurchaseTransaction(currentOrgId, currentUserUid || '', parentId, it.itemId, it.qty, inventoryItem.unitCost || it.unitPrice, note);
        if (!result.success) {
          alert(result.error || `Failed to persist linked item ${inventoryItem.name}.`);
          return null;
        }
      }
    }

    return parentId;
  };

  const handleAddTransaction = async (
    accountId: string,
    amount: number,
    type: CreditTransaction['type'],
    notes: string,
    paymentMethod?: 'Cash' | 'Mobile Money' | 'Bank',
    transactionProof?: { name: string; dataUrl: string; type: string },
    relatedCreditTxnId?: string,
    performedBy?: string
  ) => {
    if (!accountId || amount <= 0) return { success: false, error: 'A valid account and positive amount are required.' };

    const result = type === 'pay'
      ? await recordRepaymentTransaction(currentOrgId, currentUserUid || '', accountId, amount, paymentMethod || 'Cash', notes)
      : await recordCreditChargeTransaction(currentOrgId, currentUserUid || '', accountId, amount, notes);

    if (!result.success) {
      alert(result.error || 'Failed to persist the credit transaction.');
    }
    return result;
  };

  const handleSettleAccount = (accountId: string) => {
    const acc = creditAccounts.find(a => a.id === accountId);
    if (!acc || acc.remainingAmount === 0) return;

    handleAddTransaction(
      accountId,
      acc.remainingAmount,
      'pay',
      'Complete settlement allocation clearance.'
    );
  };

  // --- Handlers: Configuration Profile Save & Maintenance ---
  const handleUpdateConfig = (newConfig: BusinessConfig) => {
    // 1. Save user personal preferences under user-role specific storage key
    const userPrefKey = getUserPrefStorageKey(currentOrgId, currentUserRole);
    const userPrefs = {
      currency: newConfig.currency,
      currencySymbol: newConfig.currencySymbol,
      languageCode: newConfig.languageCode,
      themeMode: newConfig.themeMode
    };
    saveLocalState(userPrefKey, userPrefs);

    // 2. If Admin (role 2), also save organization-wide business settings
    //    locally, and push the currency to Supabase so every device and
    //    every teammate sees the same base currency in real time instead
    //    of it being stuck in this browser's local storage.
    if (currentUserRole === 2) {
      saveLocalState(getOrgStorageKey(CONFIG_KEY, currentOrgId), newConfig);

      const currencyChanged =
        newConfig.currency !== config.currency ||
        newConfig.currencySymbol !== config.currencySymbol;
      const countryChanged = newConfig.country !== config.country;

      if ((currencyChanged || countryChanged) && currentOrgId) {
        updateBusinessCurrency(currentOrgId, currentUserRole, newConfig.currency, newConfig.currencySymbol, newConfig.country)
          .then((res) => {
            if (!res.success) {
              console.error('Failed to sync currency to backend:', res.error);
            }
          });
      }
    }

    // 2b. Push the current user's own contact number to Supabase (profiles
    //     table). This is a personal field, not org-wide, so it applies to
    //     both Admin and Attendant -- previously it only ever lived in
    //     localStorage, which is why it never showed up in the backend and
    //     could silently reset (e.g. new device, cleared browser data).
    const ownPhone = currentUserRole === 2
      ? (newConfig.adminPhone ?? newConfig.phone ?? '')
      : (newConfig.attendantPhone ?? newConfig.phone ?? '');
    const prevOwnPhone = currentUserRole === 2
      ? (config.adminPhone ?? config.phone ?? '')
      : (config.attendantPhone ?? config.phone ?? '');
    if (currentUserUid && (ownPhone !== prevOwnPhone || newConfig.phone !== undefined)) {
      updateUserPhone(currentUserUid, ownPhone || '')
        .then((res) => {
          if (!res.success) {
            console.error('Failed to sync contact number to backend:', res.error);
          }
        });
    }

    if (currentUserUid && (newConfig.themeMode === 'light' || newConfig.themeMode === 'dark') && newConfig.themeMode !== config.themeMode) {
      updateUserTheme(currentUserUid, newConfig.themeMode).then((res) => {
        if (!res.success) console.error('Failed to sync theme preference to backend:', res.error);
      });
    }

    // 3. Update current active state
    setConfig(newConfig);
  };

  const handleUpdateOrganizations = (updatedOrgs: Organization[]) => {
    setOrganizations(updatedOrgs);
  };

  const handleGenerateInvite = async (): Promise<{ code: string; expiresAt: string } | null> => {
    const result = await createAttendantInvite(currentOrgId, currentUserRole || 2);
    if (!result.success || !result.code || !result.expiresAt) {
      alert(result.error || 'Failed to create attendant invite.');
      return null;
    }
    return { code: result.code, expiresAt: result.expiresAt };
  };

  const handleResetSeedData = () => {
    localStorage.removeItem(getOrgStorageKey(CONFIG_KEY, currentOrgId));
    localStorage.removeItem(getUserPrefStorageKey(currentOrgId, currentUserRole));
    localStorage.removeItem(getOrgStorageKey(INVENTORY_KEY, currentOrgId));
    localStorage.removeItem(getOrgStorageKey(ADJUSTMENTS_KEY, currentOrgId));
    localStorage.removeItem(getOrgStorageKey(CREDIT_ACCOUNTS_KEY, currentOrgId));
    localStorage.removeItem(getOrgStorageKey(TRANSACTIONS_KEY, currentOrgId));
    localStorage.removeItem(getOrgStorageKey(PENDING_RESTOCKS_KEY, currentOrgId));

    setConfig(INITIAL_BUSINESS_CONFIG);
    setInventory(INITIAL_INVENTORY);
    setAdjustments(INITIAL_ADJUSTMENTS);
    setCreditAccounts(INITIAL_CREDIT_ACCOUNTS);
    setTransactions(INITIAL_CREDIT_TRANSACTIONS);
    setPendingRestocks([]);
  };

  const handleClearTransactions = () => {
    setAdjustments([]);
    setTransactions([]);
    setPendingRestocks([]);
    setCreditAccounts((prev) =>
      prev.map((acc) => ({
        ...acc,
        totalAmount: 0,
        remainingAmount: 0,
        status: 'settled',
        lastUpdated: new Date().toISOString(),
        paymentDate: new Date().toISOString()
      }))
    );
  };

  const handleWipeStorage = () => {
    localStorage.clear();

    const wipedConfig: BusinessConfig = {
      businessName: 'My Enterprise',
      ownerName: '',
      phone: '',
      email: '',
      address: '',
      currency: 'USD',
      currencySymbol: '$',
      lowStockThresholdDefault: 5
    };

    setConfig(wipedConfig);
    setInventory([]);
    setAdjustments([]);
    setCreditAccounts([]);
    setTransactions([]);
    setPendingRestocks([]);
  };

  // --- Dashboard helper proxies ---
  const handleQuickStockIn = async (items: Array<{ itemId: string; qty: number }>, notes: string) => {
    for (const item of items) {
      await handleLogAdjustment(item.itemId, item.qty, 'purchase_in', notes);
    }
  };

  const handleQuickStockOut = async (
    items: Array<{ itemId: string; qty: number }>,
    notes: string,
    creditAccountIdOrName?: string,
    totalAmount?: number
  ) => {
    const saleItems = items.map(it => {
      const inv = inventory.find(i => i.id === it.itemId);
      return {
        itemId: it.itemId,
        name: inv ? inv.name : 'Item',
        quantity: it.qty,
        unitPrice: inv?.unitPrice || 0,
        unitCost: inv?.unitCost || 0
      };
    });
    const calculatedTotal = totalAmount || saleItems.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);

    if (!creditAccountIdOrName) {
      for (const item of saleItems) {
        await handleLogAdjustment(item.itemId, -item.quantity, 'sale_out', notes);
      }
      return;
    }

    let account = creditAccounts.find(acc => acc.id === creditAccountIdOrName) ||
      creditAccounts.find(acc => acc.name.trim().toLowerCase() === creditAccountIdOrName.trim().toLowerCase());

    if (!account) {
      const createdId = await handleAddAccount({
        name: creditAccountIdOrName.trim(),
        type: 'receivable',
        phone: '',
        email: '',
        totalAmount: 0,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: 'Created automatically via Credit Sale.'
      });
      if (!createdId) return;
      account = { id: createdId } as CreditAccount;
    }

    for (const item of saleItems) {
      await handleLogAdjustment(item.itemId, -item.quantity, 'sale_out', notes, account.id);
    }
  };

  const handleQuickRepayment = async (accountId: string, amount: number, notes: string) => {
    return handleAddTransaction(accountId, amount, 'pay', notes);
  };

  // --- Calculations for alarms inside Navigation tab ---
  const lowStockCount = inventory.filter(item => item.quantity <= item.reorderPoint).length;

  return (
    <>
      {!isLoggedIn ? (
        <div className="relative min-h-screen bg-slate-100 dark:bg-[#0A0E1A] text-slate-900 dark:text-white font-sans overflow-x-hidden flex flex-col selection:bg-blue-500/30 transition-colors duration-700">
          {/* Custom Cosmic Canvas Scroll Scrubbing Background */}
          <LandingPageBackground currentBg={landingBg} onToggleBg={setLandingBg} isDarkMode={isLandingDark} />

          {/* Top Navigation Bar with Inspiration Notch */}
          <header className="fixed top-0 left-0 right-0 z-50 neu-flat rounded-none border-b border-white/90 dark:border-slate-800/80 px-3 sm:px-6 lg:px-12 py-2.5 sm:py-3 transition-all shadow-xl backdrop-blur-md">

            {/* Center Notch Container with Logo (visible on large screens) */}
            <div
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hidden lg:flex absolute left-1/2 -translate-x-1/2 -top-0.5 neu-flat border border-white/90 dark:border-slate-700/80 px-6 sm:px-8 py-1.5 sm:py-2 rounded-b-2xl shadow-xl items-center justify-center cursor-pointer z-50 hover:scale-105 transition-all"
            >
              <span className="font-quantum tracking-[0.15em] text-sm sm:text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#0052D4] via-[#65C7F7] to-[#9CECFB] dark:from-[#9CECFB] dark:to-[#0052D4]">
                LERGON
              </span>
            </div>

            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
              {/* Left Nav Links - smoothly scrollable on compact screens */}
              <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar whitespace-nowrap py-0.5">
                {/* Compact Logo for small/minimized windows */}
                <div
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="lg:hidden flex items-center gap-1.5 pr-2.5 border-r border-slate-300 dark:border-[#0052D4]/30 mr-1 cursor-pointer shrink-0"
                >
                  <span className="font-quantum tracking-wider text-xs font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#0052D4] via-[#65C7F7] to-[#9CECFB] dark:from-[#9CECFB] dark:to-[#0052D4]">
                    LERGON
                  </span>
                </div>

                <a href="#hero" className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white px-3 py-1.5 rounded-full neu-button border border-transparent hover:border-slate-300 dark:hover:border-[#0052D4]/30 transition-all shrink-0">
                  Home
                </a>
                <a href="#feature-showcase" className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-full neu-button border border-transparent hover:border-slate-300 dark:hover:border-[#0052D4]/30 transition-all shrink-0">
                  Features
                </a>
                <a href="#solutions" className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-full neu-button border border-transparent hover:border-slate-300 dark:hover:border-[#0052D4]/30 transition-all shrink-0">
                  Solutions
                </a>
                <a
                  href="#faq"
                  className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-full neu-button border border-transparent hover:border-slate-300 dark:hover:border-[#0052D4]/30 transition-all shrink-0"
                >
                  FAQ
                </a>
              </div>

              {/* Right Nav Links */}
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                {/* Landing Page Dark/Light Theme Mode Toggle Button */}
                <button
                  type="button"
                  onClick={toggleLandingDark}
                  className="p-2 rounded-full neu-button border border-white/80 dark:border-slate-700/60 hover:scale-105 active:scale-95 transition cursor-pointer flex items-center justify-center shadow-md text-amber-500 dark:text-sky-300"
                  title={isLandingDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {isLandingDark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-sky-400" />}
                </button>

                <button
                  onClick={() => { setActiveView('signin'); setShowAuthModal(true); setLoginError(''); setForgotError(''); setSuccess(null); }}
                  className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#CBD5E1] hover:text-slate-900 dark:hover:text-white px-3.5 py-1.5 rounded-full neu-button transition-all cursor-pointer"
                >
                  Login
                </button>
                <button
                  onClick={() => { setActiveView('register'); setShowAuthModal(true); setLoginError(''); setForgotError(''); setSuccess(null); }}
                  className="neu-button active-tab text-white font-extrabold text-xs sm:text-sm px-4 sm:px-6 py-1.5 sm:py-2 rounded-full shadow-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  Register
                </button>
              </div>
            </div>
          </header>

          {/* Main Landing Sections Overlay Container */}
          <main className="relative z-10 w-full flex-1">
            {/* --- SECTION 1: HERO (Main Headline & Hook) --- */}
            <section id="hero" className="relative min-h-[88vh] flex flex-col items-center justify-center text-center px-4 sm:px-6 pt-24 sm:pt-28 pb-16 overflow-hidden">
              <div className="max-w-4xl mx-auto space-y-6 flex flex-col items-center relative z-10">

                {/* Main Headline (h1, parallax-fast) */}
                <h1 className="h1 parallax-fast font-quantum font-black text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#0052D4] via-[#65C7F7] to-[#9CECFB] dark:from-[#9CECFB] dark:via-[#65C7F7] dark:to-[#0052D4] leading-tight pt-2 drop-shadow-[0_0_35px_rgba(0,82,212,0.35)]">
                  Run the Business We've Got the Numbers
                </h1>

                {/* Sub-headline (p, parallax-slow) */}
                <p className="p parallax-slow font-sans text-base sm:text-xl md:text-2xl text-slate-700 dark:text-[#CBD5E1] max-w-2xl mx-auto font-medium leading-relaxed">
                  Experience a unified ecosystem where your inventory, debtor ledger, and cash performance work together to drive your growth
                </p>

                {/* Primary Action Buttons */}
                <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
                  {/* Primary CTA (neu-button active-tab) */}
                  <button
                    onClick={() => { setActiveView('register'); setShowAuthModal(true); setLoginError(''); setForgotError(''); setSuccess(null); }}
                    className="neu-button active-tab px-8 sm:px-10 py-4 sm:py-4.5 rounded-full inline-flex items-center gap-3.5 shadow-2xl font-quantum font-black uppercase tracking-[0.15em] text-base sm:text-lg group cursor-pointer"
                  >
                    <span>Meet Your New Partner</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </button>

                  {/* Secondary CTA (neu-button) */}
                  <button
                    onClick={() => {
                      const el = document.getElementById('live-metrics');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                      else { setActiveView('signin'); setShowAuthModal(true); }
                    }}
                    className="neu-button px-8 sm:px-10 py-4 sm:py-4.5 rounded-full inline-flex items-center gap-3 font-quantum font-bold uppercase tracking-[0.15em] text-slate-800 dark:text-white text-base sm:text-lg cursor-pointer"
                  >
                    <span>Explore the Dashboard</span>
                  </button>
                </div>

              </div>
            </section>

            {/* --- SECTION 1.5: POWERED BY GEMINI TRUST BANNER --- */}
            <section className="py-6 px-6 max-w-7xl mx-auto flex items-center justify-center">
              <div className="flex items-center gap-3 neu-flat px-6 sm:px-8 py-3 rounded-full shadow-xl hover:scale-105 transition-all cursor-default text-slate-900 dark:text-white">
                <GeminiSparkleLogo size={26} />
                <span className="font-quantum font-bold tracking-[0.2em] text-xs sm:text-sm text-transparent bg-clip-text bg-gradient-to-r from-[#0052D4] via-[#65C7F7] to-[#9CECFB] dark:from-[#9CECFB] dark:to-[#0052D4] uppercase">
                  POWERED BY GEMINI AI
                </span>
              </div>
            </section>

            {/* --- SECTION 2: LIVE METRICS SHOWCASE (Interactive Stat Grid) --- */}
            <section id="live-metrics" className="max-w-7xl mx-auto px-6 lg:px-12 py-16 md:py-24 space-y-12">
              <div className="text-center max-w-3xl mx-auto space-y-4">
                {/* Section Title (h2, parallax-fast) */}
                <h2 className="h2 parallax-fast font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight">
                  Decisions Driven by Real Time Data
                </h2>
                {/* Section Subtitle (p, parallax-slow) */}
                <p className="p parallax-slow font-sans text-base sm:text-lg text-slate-700 dark:text-[#CBD5E1]/90 leading-relaxed font-medium">
                  A true partner gives you the exact metrics you need exactly when you need them
                </p>
              </div>

              {/* Stat Cards Grid (3 cards using neu-flat push-out) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Card 1 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-5 text-left border border-white/90 dark:border-slate-800/80">
                  <div className="neu-inset px-4 py-2.5 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">TOTAL INVENTORY VALUE</span>
                    <span className="material-symbols-outlined text-[#0052D4] dark:text-[#9CECFB] text-xl">account_balance_wallet</span>
                  </div>
                  <div className="font-heading font-black text-3xl sm:text-4xl text-[#0052D4] dark:text-[#9CECFB] tracking-tight">
                    GH₵300.00
                  </div>
                  <div className="neu-inset px-3.5 py-1.5 rounded-xl font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-bold inline-block">
                    Your Capital at a Glance
                  </div>
                </div>

                {/* Card 2 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-5 text-left border border-white/90 dark:border-slate-800/80">
                  <div className="neu-inset px-4 py-2.5 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">STOCK IN HAND</span>
                    <span className="material-symbols-outlined text-[#0052D4] dark:text-[#9CECFB] text-xl">inventory</span>
                  </div>
                  <div className="font-heading font-black text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
                    3 Active Items
                  </div>
                  <div className="neu-inset px-3.5 py-1.5 rounded-xl font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-bold inline-block">
                    Live Asset Tracking
                  </div>
                </div>

                {/* Card 3 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-5 text-left border border-white/90 dark:border-slate-800/80">
                  <div className="neu-inset px-4 py-2.5 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">REALIZED PROFIT</span>
                    <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-xl">trending_up</span>
                  </div>
                  <div className="font-heading font-black text-3xl sm:text-4xl text-emerald-600 dark:text-emerald-400 tracking-tight">
                    GH₵0.00
                  </div>
                  <div className="neu-inset px-3.5 py-1.5 rounded-xl font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-200 font-bold inline-block">
                    Your True Bottom Line
                  </div>
                </div>
              </div>
            </section>

            {/* --- SECTION 3: CORE CAPABILITIES (Feature Cards Grid) --- */}
            <section id="feature-showcase" className="max-w-7xl mx-auto px-6 lg:px-12 py-16 md:py-24 space-y-14">
              <div className="text-center max-w-3xl mx-auto space-y-4">
                {/* Section Title (h2, parallax-fast) */}
                <h2 className="h2 parallax-fast font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight">
                  Built to Protect and Scale Your Enterprise
                </h2>
                {/* Section Subtitle (p, parallax-slow) */}
                <p className="p parallax-slow font-sans text-base sm:text-lg text-slate-700 dark:text-[#CBD5E1]/90 leading-relaxed font-medium">
                  More than a ledger LERGON actively monitors the health of your daily operations
                </p>
              </div>

              {/* Feature Cards Grid (4 cards using neu-flat push-out) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Feature 1 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-4 text-left border border-white/90 dark:border-slate-800/80">
                  <div className="w-14 h-14 rounded-2xl neu-inset inline-flex items-center justify-center border border-white/80 dark:border-slate-800/80 shadow-inner">
                    <span className="material-symbols-outlined text-2xl text-[#0052D4] dark:text-[#9CECFB]">pie_chart</span>
                  </div>
                  <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                    Strategic Asset Analysis
                  </h3>
                  <p className="font-sans text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    Visualize exactly where your capital is tied up with interactive real time distribution charts
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-4 text-left border border-white/90 dark:border-slate-800/80">
                  <div className="w-14 h-14 rounded-2xl neu-inset inline-flex items-center justify-center border border-white/80 dark:border-slate-800/80 shadow-inner">
                    <span className="material-symbols-outlined text-2xl text-[#0052D4] dark:text-[#9CECFB]">handshake</span>
                  </div>
                  <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                    Automated Credit Management
                  </h3>
                  <p className="font-sans text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    Never lose track of a debtor monitor outstanding credit, manage repayments, and secure your cash flow
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-4 text-left border border-white/90 dark:border-slate-800/80">
                  <div className="w-14 h-14 rounded-2xl neu-inset inline-flex items-center justify-center border border-white/80 dark:border-slate-800/80 shadow-inner">
                    <span className="material-symbols-outlined text-2xl text-[#0052D4] dark:text-[#9CECFB]">payments</span>
                  </div>
                  <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                    Liquid Cash Performance
                  </h3>
                  <p className="font-sans text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    Instantly separate cash sales from credit debts to understand your true purchasing power today
                  </p>
                </div>

                {/* Feature 4 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-4 text-left border border-white/90 dark:border-slate-800/80">
                  <div className="w-14 h-14 rounded-2xl neu-inset inline-flex items-center justify-center border border-white/80 dark:border-slate-800/80 shadow-inner">
                    <span className="material-symbols-outlined text-2xl text-[#0052D4] dark:text-[#9CECFB]">inventory_2</span>
                  </div>
                  <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                    Intelligent Inventory Showcase
                  </h3>
                  <p className="font-sans text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    Monitor your highest performing assets, track retail vs supplier costs, and optimize your profit margins effortlessly
                  </p>
                </div>
              </div>
            </section>

            {/* --- SECTION: SOLUTIONS --- */}
            <section id="solutions" className="max-w-7xl mx-auto px-6 lg:px-12 py-16 md:py-24 space-y-14">
              <div className="text-center max-w-3xl mx-auto space-y-4">
                {/* Section Title (h2, parallax-fast) */}
                <h2 className="h2 parallax-fast font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl text-slate-900 dark:text-white tracking-tight">
                  Built for the way you actually run the business
                </h2>
                {/* Section Subtitle (p, parallax-slow) */}
                <p className="p parallax-slow font-sans text-base sm:text-lg text-slate-700 dark:text-[#CBD5E1]/90 leading-relaxed font-medium">
                  Real situations Real fixes No spreadsheets required
                </p>
              </div>

              {/* Solutions Cards Grid (4 cards using neu-flat push-out, 2x2 grid on desktop, single col on mobile) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Solution 1 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-5 text-left border border-white/90 dark:border-slate-800/80 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-2xl neu-inset inline-flex items-center justify-center border border-white/80 dark:border-slate-800/80 shadow-inner">
                      <span className="material-symbols-outlined text-2xl text-[#0052D4] dark:text-[#9CECFB]">inventory_2</span>
                    </div>
                    <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                      Track Everything
                    </h3>
                    <p className="font-sans text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      Real time inventory tracking with a clear split between capital invested and profit earned. Know exactly where your money is at all times.
                    </p>
                  </div>
                  <ul className="space-y-2.5 pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Live stock levels and low stock alerts</span>
                    </li>
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Capital vs profit separation</span>
                    </li>
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Retail value tracking</span>
                    </li>
                  </ul>
                </div>

                {/* Solution 2 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-5 text-left border border-white/90 dark:border-slate-800/80 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-2xl neu-inset inline-flex items-center justify-center border border-white/80 dark:border-slate-800/80 shadow-inner">
                      <span className="material-symbols-outlined text-2xl text-[#0052D4] dark:text-[#9CECFB]">credit_score</span>
                    </div>
                    <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                      Never Lose Money on Credit
                    </h3>
                    <p className="font-sans text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      A built in IOU ledger that tracks every customer credit, so nothing slips through the cracks.
                    </p>
                  </div>
                  <ul className="space-y-2.5 pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Customer credit (IOU) tracking</span>
                    </li>
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Payment history per customer</span>
                    </li>
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Automated reminders</span>
                    </li>
                  </ul>
                </div>

                {/* Solution 3 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-5 text-left border border-white/90 dark:border-slate-800/80 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-2xl neu-inset inline-flex items-center justify-center border border-white/80 dark:border-slate-800/80 shadow-inner">
                      <span className="material-symbols-outlined text-2xl text-[#0052D4] dark:text-[#9CECFB]">auto_awesome</span>
                    </div>
                    <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                      Your AI Business Partner
                    </h3>
                    <p className="font-sans text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      Ask questions, log sales by voice, and get smart restocking suggestions, powered by Gemini AI.
                    </p>
                  </div>
                  <ul className="space-y-2.5 pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Natural language business Q&amp;A</span>
                    </li>
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Voice input for fast logging</span>
                    </li>
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>AI driven restock suggestions</span>
                    </li>
                  </ul>
                </div>

                {/* Solution 4 */}
                <div className="neu-flat push-out rounded-3xl p-8 space-y-5 text-left border border-white/90 dark:border-slate-800/80 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-2xl neu-inset inline-flex items-center justify-center border border-white/80 dark:border-slate-800/80 shadow-inner">
                      <span className="material-symbols-outlined text-2xl text-[#0052D4] dark:text-[#9CECFB]">receipt_long</span>
                    </div>
                    <h3 className="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                      Get Paid, Stay Organized
                    </h3>
                    <p className="font-sans text-sm sm:text-base text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      Generate invoices and receipts instantly, and get automated daily summaries of your business performance.
                    </p>
                  </div>
                  <ul className="space-y-2.5 pt-4 border-t border-slate-200/60 dark:border-slate-800/80">
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Invoice and receipt generator</span>
                    </li>
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Daily and weekly close out reports</span>
                    </li>
                    <li className="flex items-center gap-2.5 font-sans text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <span className="material-symbols-outlined text-base text-[#0052D4] dark:text-[#9CECFB] shrink-0">check_circle</span>
                      <span>Expense tracking</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* --- SECTION 4: CALL TO ACTION (Footer CTA) --- */}
            <section id="final-cta" className="max-w-5xl mx-auto px-6 py-16 my-8 text-center">
              <div className="neu-flat push-out container rounded-3xl p-10 md:p-16 space-y-8 text-center border border-white/90 dark:border-slate-800/80">
                {/* Headline (h2, parallax-fast) */}
                <h2 className="h2 parallax-fast font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-slate-900 dark:text-white tracking-tight leading-tight">
                  Ready to Scale with Confidence?
                </h2>
                {/* Subtext (p, parallax-slow) */}
                <p className="p parallax-slow font-sans text-base sm:text-lg md:text-xl text-slate-800 dark:text-slate-200 max-w-2xl mx-auto leading-relaxed font-semibold">
                  Join forward-thinking entrepreneurs who trust LERGON as their ultimate business partner
                </p>
                {/* CTA Button (neu-button active-tab) */}
                <div className="pt-2">
                  <button
                    onClick={() => { setActiveView('register'); setShowAuthModal(true); setLoginError(''); setForgotError(''); setSuccess(null); }}
                    className="neu-button active-tab px-10 py-4.5 rounded-full inline-flex items-center gap-3.5 shadow-2xl font-quantum font-black uppercase tracking-[0.15em] text-lg sm:text-xl group cursor-pointer"
                  >
                    <span>Partner with LERGON Today</span>
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </button>
                </div>
              </div>
            </section>

            {/* --- SECTION 5: TRUST & FAQ --- */}
            <section id="faq" className="max-w-7xl mx-auto px-6 lg:px-12 py-16 md:py-24">
              <div className="text-center mb-14">
                <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-slate-900 dark:text-white tracking-tight">
                  Frequently Asked Questions
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {[
                  {
                    q: "Is my data secure?",
                    a: "Yes — your business records and customer credit ledger are end-to-end encrypted and strictly isolated per organization, with role-based staff access control"
                  },
                  {
                    q: "Does it work offline?",
                    a: "LERGON currently requires an internet connection to work, since your data is synced and stored securely online in real time — offline support may be considered in a future update"
                  },
                  {
                    q: "Who is LERGON designed for?",
                    a: "LERGON is built for retail and shop operators who need to track inventory, manage customer credit, and understand their real cash position without relying on spreadsheets or manual notebooks"
                  },
                  {
                    q: "What can LERGON do that a spreadsheet can't?",
                    a: "A spreadsheet only stores what you type in — LERGON actively tracks stock levels, flags overdue credit, separates capital from profit automatically, and surfaces insights through Gemini powered AI, all in real time and without manual upkeep"
                  },
                  {
                    q: "What powers the AI in LERGON?",
                    a: "LERGON's AI features are powered by Gemini, helping surface insights like restock alerts and answering business questions in real time"
                  },
                  {
                    q: "How much does it cost?",
                    a: "LERGON is currently free to use while in early access — pricing plans will be introduced later as new features roll out, and existing users will be notified in advance of any changes"
                  },
                  {
                    q: "How long does setup take?",
                    a: "Most businesses are up and running in under 10 minutes — add your inventory, invite staff if needed, and the dashboard starts tracking immediately"
                  },
                  {
                    q: "Can multiple staff members use it?",
                    a: "Yes — LERGON supports role-based access, so staff can be given specific permissions, like recording sales, without full access to sensitive data such as profit margins or the credit ledger"
                  }
                ].map((faq, idx) => (
                  <div
                    key={idx}
                    className="neu-flat rounded-2xl overflow-hidden transition-all border border-white/90 dark:border-slate-800/80"
                  >
                    <button
                      onClick={() => setActiveFaqIndex(activeFaqIndex === idx ? null : idx)}
                      className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 font-heading font-extrabold text-base sm:text-lg text-slate-900 dark:text-white hover:text-[#0052D4] dark:hover:text-[#9CECFB] transition-colors cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-[#0052D4] dark:text-[#9CECFB] shrink-0">
                        {activeFaqIndex === idx ? <Minus size={18} /> : <Plus size={18} />}
                      </div>
                    </button>

                    {activeFaqIndex === idx && (
                      <div className="px-5 sm:px-6 pb-5 sm:pb-6 text-xs sm:text-sm font-sans text-slate-800 dark:text-slate-200 leading-relaxed pt-4 neu-inset m-3 rounded-xl font-medium">
                        {faq.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* --- SECTION 6: FOOTER --- */}
            <footer id="footer" className="neu-flat py-8 px-6 lg:px-12 text-slate-800 dark:text-slate-200 font-sans text-xs sm:text-sm rounded-t-3xl border-t border-white/90 dark:border-slate-800/80">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

                {/* Logo & Tagline */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-tr from-[#0052D4] to-[#9CECFB] dark:from-[#9CECFB] dark:to-[#0052D4] rounded-lg flex items-center justify-center text-white dark:text-[#0A0E1A] font-black text-sm shadow-md">
                    L
                  </div>
                  <div>
                    <span className="font-quantum font-bold text-slate-900 dark:text-white tracking-wider block text-sm">LERGON</span>
                    <span className="text-[10px] font-mono text-slate-700 dark:text-slate-300 font-semibold">LERGON AI Business Infrastructure</span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono text-center md:text-right font-semibold">
                  © 2026 LERGON Built for LERGON AI
                </p>
              </div>
            </footer>
          </main>

          {/* Floating Neumorphic Scroll-to-Top Button */}
          {showScrollTop && (
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="fixed bottom-6 right-6 z-50 neu-button active-tab w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center border border-white/80 dark:border-slate-700/60"
              title="Scroll to top"
              aria-label="Scroll to top"
            >
              <span className="material-symbols-outlined text-2xl sm:text-3xl text-white font-extrabold">arrow_upward</span>
            </button>
          )}


          {/* --- AUTH MODAL OVERLAY (SIGN IN / REGISTER / FORGOT PASSCODE) --- */}
          {showAuthModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
              <div className="w-full max-w-[430px] neumorphic-card border border-white/80 dark:border-slate-700/80 rounded-[2rem] p-7 sm:p-8 relative overflow-hidden bg-white dark:bg-[#15171a] shadow-xl">

                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowAuthModal(false);
                    setPendingVerifyEmail('');
                    setEmailOtpSuccess('');
                    setSuccess(null);
                    setLoginError('');
                    setForgotError('');
                    setRegisterError('');
                    setJoinError('');
                    setEmailOtpError('');
                  }}
                  className="absolute top-5 right-5 w-9 h-9 rounded-full neumorphic-circle border border-white/80 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer z-20 bg-slate-100 dark:bg-slate-900 shadow-sm"
                >
                  <X size={18} />
                </button>

                {/* Modal Header */}
                {activeView !== 'verify_email' && (
                  <div className="text-left mb-6 relative z-10 pr-8">
                    <h2 className="text-3xl font-quantum font-black text-slate-900 dark:text-white mb-1 tracking-tight">
                      {activeView === 'forgot' ? 'Reset Passcode' :
                        activeView === 'register' ? 'Register Account' :
                          activeView === 'join' ? 'Join a Business' :
                            activeView === 'attendant_set_password' ? 'Set Your Password' :
                              'Login'}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans font-medium">
                      {activeView === 'forgot' ? 'Enter details to recover operator passcode' :
                        activeView === 'register' ? 'Set up your business profile in under a minute' :
                          activeView === 'join' ? 'Enter the code your admin shared with you' :
                            activeView === 'attendant_set_password' ? `You're joining ${validatedJoinOrg?.name || 'the shop'}` :
                              'Welcome back please login to your account'}
                    </p>
                  </div>
                )}

                {/* Dynamic Feedback Toasts */}
                {(loginError || forgotError || registerError || joinError || attendantPasswordError || emailOtpError) && (
                  <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-xl p-3 text-xs text-rose-700 dark:text-rose-300 mb-4 animate-fadeIn relative z-10 font-medium">
                    <AlertCircle size={16} className="text-rose-500 shrink-0" />
                    <span>{loginError || forgotError || registerError || joinError || attendantPasswordError || emailOtpError}</span>
                  </div>
                )}
                {activeView !== 'verify_email' && success && (
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-300 mb-4 animate-fadeIn relative z-10 font-medium">
                    <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                    <span>{success}</span>
                  </div>
                )}

                {/* --- 1. SIGN IN --- */}
                {activeView === 'signin' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleLoginSubmit(loginEmail, passcode);
                    }}
                    className="relative z-10 space-y-4"
                  >
                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={loginEmail}
                        onFocus={() => setIsLoginEmailFocused(true)}
                        onBlur={() => setIsLoginEmailFocused(false)}
                        onChange={(e) => {
                          setLoginEmail(e.target.value);
                          if (loginError) setLoginError('');
                        }}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400/80 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <Mail className="absolute right-4 top-[38px] text-sky-600 dark:text-sky-400 pointer-events-none" size={20} />
                    </div>

                    {/* Real-time Email Validation Checklist */}
                    <EmailValidationChecklist email={loginEmail} isFocused={isLoginEmailFocused} />

                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={passcode}
                        onChange={(e) => {
                          setPasscode(e.target.value);
                          if (loginError) setLoginError('');
                        }}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-600 dark:text-sky-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    {success && success.includes('confirmation link') && (
                      <div className="flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-600 dark:text-emerald-400 pt-1 animate-fadeIn">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        <span>Check your email for a confirmation link!</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 pb-1">
                      <label
                        onClick={() => setRememberMe(!rememberMe)}
                        className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-700 dark:text-slate-200 select-none font-medium"
                      >
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all neumorphic-btn ${rememberMe ? 'bg-sky-600 border-sky-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700'}`}
                        >
                          {rememberMe && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span className="font-medium text-sm">Remember me</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveView('forgot');
                          setLoginError('');
                          setForgotError('');
                          setForgotUsername('');
                          if (organizations.length > 0) {
                            setForgotOrgId(organizations[0].id);
                          }
                        }}
                        className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors cursor-pointer font-semibold"
                      >
                        Forgot password?
                      </button>
                    </div>

                    {/* Neumorphic 3D Login Button without heavy glow */}
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-base py-3.5 rounded-2xl neumorphic-btn flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer mt-2 border border-white/30 dark:border-slate-700/60 shadow-md"
                    >
                      Login
                    </button>

                    <div className="flex flex-col gap-1.5 pt-2 text-center text-sm text-slate-700 dark:text-slate-300 font-medium">
                      <p>
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => { setActiveView('register'); setLoginError(''); setForgotError(''); setSuccess(null); }}
                          className="text-sky-600 dark:text-sky-400 font-bold hover:underline transition-colors cursor-pointer"
                        >
                          Signup
                        </button>
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Joining a business?{' '}
                        <button
                          type="button"
                          onClick={() => { setActiveView('join'); setLoginError(''); setJoinError(''); setInviteCodeInput(''); setSuccess(null); }}
                          className="text-sky-600 dark:text-sky-400 font-bold hover:underline transition-colors cursor-pointer"
                        >
                          Enter invite code
                        </button>
                      </p>
                    </div>
                  </form>
                )}

                {/* --- 2. ADMIN REGISTRATION --- */}
                {activeView === 'register' && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setRegisterError('');
                      if (organizations.length >= 1000) {
                        setRegisterError('Maximum registration limit of 1000 organizations has been reached.');
                        return;
                      }
                      setIsRegLoading(true);
                      setRegLoadingText('Registering Business...');
                      const slowTimer = setTimeout(() => {
                        setRegLoadingText('Almost there...');
                      }, 2500);

                      console.log('[Admin Signup Form] Form submitted. Triggering handleRegisterOrganization...');
                      try {
                        const registered = await handleRegisterOrganization(newOrgAdminEmail, newOrgName, newOrgAdminPass);
                        if (registered) {
                          console.log('[Admin Signup Form] Registration successful for org:', registered.id);
                          setNewOrgAdminEmail('');
                          setNewOrgName('');
                          setNewOrgAdminPass('');
                          setSuccess('Business registered! Setting up your dashboard...');
                          await new Promise(res => setTimeout(res, 1200));
                          setSuccess(null);
                        } else {
                          console.warn('[Admin Signup Form] handleRegisterOrganization returned null.');
                        }
                      } catch (formErr: any) {
                        console.error('SIGNUP ERROR:', formErr);
                        setRegisterError(formErr?.message || 'Registration failed. Please try again.');
                      } finally {
                        clearTimeout(slowTimer);
                        console.log('[Admin Signup Form] Unlocking submit button.');
                        setIsRegLoading(false);
                      }
                    }}
                    className="relative z-10 space-y-4"
                  >
                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={newOrgAdminEmail}
                        onFocus={() => setIsRegEmailFocused(true)}
                        onBlur={() => setIsRegEmailFocused(false)}
                        onChange={(e) => setNewOrgAdminEmail(e.target.value)}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400/80 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <Mail className="absolute right-4 top-[38px] text-sky-600 dark:text-sky-400 pointer-events-none" size={20} />
                    </div>

                    {/* Real-time Email Validation Checklist */}
                    <EmailValidationChecklist email={newOrgAdminEmail} isFocused={isRegEmailFocused} />

                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Business Name
                      </label>
                      <input
                        type="text"
                        placeholder="Business Name"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <Building2 className="absolute right-4 top-[38px] text-sky-600 dark:text-sky-400 pointer-events-none" size={20} />
                    </div>

                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Password
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={newOrgAdminPass}
                        onFocus={() => setIsRegPassFocused(true)}
                        onBlur={() => setIsRegPassFocused(false)}
                        onChange={(e) => setNewOrgAdminPass(e.target.value)}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-[38px] text-sky-600 dark:text-sky-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    {/* Real-time Password Strength Checklist (Shown on focus / typing) */}
                    <PasswordValidationChecklist password={newOrgAdminPass} isFocused={isRegPassFocused} />

                    <button
                      type="submit"
                      disabled={isRegLoading}
                      className="w-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-base py-3.5 rounded-2xl neumorphic-btn flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer mt-3 border border-white/30 dark:border-slate-700/60 shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isRegLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>{regLoadingText}</span>
                        </>
                      ) : (
                        <>
                          <Globe size={20} />
                          <span>Create Business</span>
                        </>
                      )}
                    </button>

                    <p className="text-center text-sm text-slate-700 dark:text-slate-300 pt-2 font-medium">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => { setActiveView('signin'); setLoginError(''); setForgotError(''); setSuccess(null); }}
                        className="text-sky-600 dark:text-sky-400 font-bold hover:underline transition-colors cursor-pointer"
                      >
                        Sign In
                      </button>
                    </p>
                  </form>
                )}

                {/* --- 3. ATTENDANT JOIN --- */}
                {activeView === 'join' && (
                  <form onSubmit={handleAttendantJoinSubmit} className="relative z-10 space-y-4">
                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Invite Code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter Invite Code"
                        value={inviteCodeInput}
                        onChange={(e) => {
                          setInviteCodeInput(e.target.value);
                          if (joinError) setJoinError('');
                        }}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-mono font-extrabold tracking-wider"
                      />
                      <KeyRound className="absolute right-4 top-[38px] text-sky-600 dark:text-sky-400 pointer-events-none" size={20} />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-base py-3.5 rounded-2xl neumorphic-btn flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer mt-3 border border-white/30 dark:border-slate-700/60 shadow-md"
                    >
                      Continue
                    </button>

                    <p className="text-center text-sm text-slate-700 dark:text-slate-300 pt-2 font-medium">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => { setActiveView('signin'); setLoginError(''); setJoinError(''); setSuccess(null); }}
                        className="text-sky-600 dark:text-sky-400 font-bold hover:underline transition-colors cursor-pointer"
                      >
                        Sign In
                      </button>
                    </p>
                  </form>
                )}

                {/* --- 4. ATTENDANT SET PASSWORD --- */}
                {activeView === 'attendant_set_password' && (
                  <form onSubmit={handleAttendantSetPasswordSubmit} className="relative z-10 space-y-4">
                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={attendantEmail}
                        onFocus={() => setIsAttendantEmailFocused(true)}
                        onBlur={() => setIsAttendantEmailFocused(false)}
                        onChange={(e) => {
                          setAttendantEmail(e.target.value);
                          if (attendantPasswordError) setAttendantPasswordError('');
                        }}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400/80 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <Mail className="absolute right-4 top-[38px] text-sky-600 dark:text-sky-400 pointer-events-none" size={20} />
                    </div>

                    {/* Real-time Email Validation Checklist */}
                    <EmailValidationChecklist email={attendantEmail} isFocused={isAttendantEmailFocused} />

                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Password
                      </label>
                      <input
                        type={showAttendantPassword ? "text" : "password"}
                        placeholder="Enter Password"
                        value={attendantPassword}
                        onFocus={() => setIsAttendantPassFocused(true)}
                        onBlur={() => setIsAttendantPassFocused(false)}
                        onChange={(e) => {
                          setAttendantPassword(e.target.value);
                          if (attendantPasswordError) setAttendantPasswordError('');
                        }}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAttendantPassword(!showAttendantPassword)}
                        className="absolute right-4 top-[38px] text-sky-600 dark:text-sky-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {showAttendantPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    {/* Real-time Password Strength Checklist (Shown on focus / typing) */}
                    <PasswordValidationChecklist password={attendantPassword} isFocused={isAttendantPassFocused} />

                    <div className="relative">
                      <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type={showAttendantConfirmPassword ? "text" : "password"}
                        placeholder="Confirm Password"
                        value={attendantConfirmPassword}
                        onChange={(e) => {
                          setAttendantConfirmPassword(e.target.value);
                          if (attendantPasswordError) setAttendantPasswordError('');
                        }}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAttendantConfirmPassword(!showAttendantConfirmPassword)}
                        className="absolute right-4 top-[38px] text-sky-600 dark:text-sky-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        {showAttendantConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-base py-3.5 rounded-2xl neumorphic-btn flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer mt-3 border border-white/30 dark:border-slate-700/60 shadow-md"
                    >
                      Join {validatedJoinOrg?.name || 'Shop'}
                    </button>
                  </form>
                )}

                {/* --- 5. VERIFY EMAIL LINK WORKFLOW --- */}
                {activeView === 'verify_email' && (
                  <div className="relative z-10 space-y-5 py-2">
                    {/* Neumorphic Envelope Card */}
                    <div className="bg-slate-100 dark:bg-slate-900 border border-white/80 dark:border-slate-800 rounded-3xl p-6 shadow-[8px_8px_20px_rgba(0,0,0,0.08),-8px_-8px_20px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_20px_rgba(0,0,0,0.5),-8px_-8px_20px_rgba(30,41,59,0.3)] text-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-sky-50 dark:bg-sky-950/60 text-sky-500 border border-white/60 dark:border-slate-800 shadow-inner">
                        <Mail className="w-8 h-8 animate-bounce" />
                      </div>
                      <h3 className="text-lg font-quantum font-extrabold text-slate-900 dark:text-white">
                        Verify Your Email
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                        We have sent you a verification email to <span className="font-extrabold text-sky-600 dark:text-sky-400 break-all">{pendingVerifyEmail || 'your email address'}</span>. Please verify it and log in.
                      </p>
                    </div>

                    {/* Neumorphic Action Buttons */}
                    <div className="space-y-3 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (pendingVerifyEmail) {
                            setLoginEmail(pendingVerifyEmail);
                          }
                          setPendingVerifyEmail('');
                          setPasscode('');
                          setLoginError('');
                          setEmailOtpError('');
                          setEmailOtpSuccess('');
                          setSuccess(null);
                          setActiveView('signin');
                        }}
                        className="w-full bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-base py-3.5 rounded-2xl neumorphic-btn flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer border border-white/30 dark:border-slate-700/60 shadow-md"
                      >
                        <LogIn size={20} />
                        <span>Log In</span>
                      </button>

                      <button
                        type="button"
                        disabled={isResendOtpDisabled}
                        onClick={handleResendEmailOtp}
                        className={`w-full py-3.5 px-4 rounded-2xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 border ${isResendOtpDisabled
                          ? 'bg-slate-100/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                          : 'bg-slate-100 dark:bg-slate-900 border-white/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-[4px_4px_10px_rgba(0,0,0,0.06),-4px_-4px_10px_rgba(255,255,255,0.9)] dark:shadow-[4px_4px_10px_rgba(0,0,0,0.4),-4px_-4px_10px_rgba(30,41,59,0.3)] hover:shadow-md active:shadow-inner cursor-pointer'
                          }`}
                      >
                        <RefreshCw size={16} className={isResendOtpDisabled ? "" : "text-sky-500"} />
                        <span>{isResendOtpDisabled ? `Resend Verification Email (${resendOtpCountdown}s)` : 'Resend Verification Email'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* --- 3. RECOVERY --- */}
                {activeView === 'forgot' && (
                  <form onSubmit={handleForgotSubmit} className="relative z-10 space-y-4">
                    <div className="relative">
                      <select
                        value={forgotOrgId}
                        onChange={(e) => {
                          setForgotOrgId(e.target.value);
                          if (forgotError) setForgotError('');
                        }}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-10 text-sm text-slate-900 dark:text-white focus:outline-none appearance-none cursor-pointer border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      >
                        <option value="" disabled className="bg-white dark:bg-[#0A0E1A] text-slate-900 dark:text-white">Select Registered Organization</option>
                        {organizations.map((org) => (
                          <option key={org.id} value={org.id} className="bg-white dark:bg-[#0A0E1A] text-slate-900 dark:text-white">{org.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Attendant Username (e.g. Samuel Zar)"
                        value={forgotUsername}
                        onChange={(e) => {
                          setForgotUsername(e.target.value);
                          if (forgotError) setForgotError('');
                        }}
                        className="w-full neumorphic-inset rounded-2xl py-3.5 pl-5 pr-12 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                      />
                      <User className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-600 dark:text-sky-400 pointer-events-none" size={20} />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { setActiveView('signin'); setLoginError(''); setForgotError(''); setSuccess(null); }}
                        className="flex-1 neumorphic-btn border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-white font-semibold py-3.5 rounded-2xl transition-all cursor-pointer bg-slate-100 dark:bg-slate-900"
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        className="flex-[1.5] bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 text-white font-extrabold py-3.5 rounded-2xl neumorphic-btn transition-all cursor-pointer shadow-md"
                      >
                        Reset Request
                      </button>
                    </div>
                  </form>
                )}

              </div>
            </div>
          )}
        </div>
      ) : (
        <CurrencyProvider currency={config.currency} currencySymbol={config.currencySymbol}>
          <Navigation
            activeScreen={activeScreen}
            setActiveScreen={setActiveScreen}
            config={config}
            warningAlertCount={lowStockCount}
            onLogout={handleLogout}
            inventory={inventory}
            creditAccounts={creditAccounts}
            adjustments={adjustments}
            transactions={transactions}
            userRole={currentUserRole || undefined}
            organizationName={organizations.find(o => o.id === currentOrgId)?.name}
            currentUserName={activeUserName}
            currentUserPhoto={activeUserPhoto}
            currentOrg={organizations.find(o => o.id === currentOrgId)}
            onNavigateToSettingsTab={(tab) => setSettingsTabOverride(tab)}
            pendingRestocks={pendingRestocks}
            onNavigateToInventoryTab={(tab) => setInventoryTabOverride(tab)}
            readNotificationIds={readNotificationIds}
            themeMode={config.themeMode}
            onThemeChange={(theme) => handleUpdateConfig({ ...config, themeMode: theme })}
            onMarkAsRead={(ids) => {
              setReadNotificationIds(prev => Array.from(new Set([...prev, ...ids])));
              markNotificationsAsRead(currentUserUid, ids, currentOrgId);
            }}
          >
            {/* Dynamic Screen Routing */}
            {activeScreen === 'dashboard' && (
              <DashboardScreen
                inventory={inventory}
                creditAccounts={creditAccounts}
                adjustments={adjustments}
                transactions={transactions}
                config={config}
                isLoading={isDataLoading}
                onQuickStockIn={handleQuickStockIn}
                onQuickStockOut={handleQuickStockOut}
                onQuickRepayment={handleQuickRepayment}
                userRole={currentUserRole || undefined}
                onUpdateConfig={handleUpdateConfig}
                onNavigate={(screen) => {
                  if (screen === 'credit-new') {
                    setActiveScreen('credit');
                    setInitialOpenAddModal(true);
                  } else {
                    setActiveScreen(screen as any);
                  }
                }}
              />
            )}

            {activeScreen === 'notifications' && (
              <NotificationsScreen
                insights={insights}
                loadingInsights={loadingInsights}
                insightsError={insightsError}
                onRefreshInsights={fetchInsights}
                creditInsights={creditInsights}
                loadingCreditInsights={loadingCreditInsights}
                creditInsightsError={creditInsightsError}
                onRefreshCreditInsights={fetchCreditInsights}
                onRefreshAllInsights={fetchAllInsights}
                inventory={inventory}
                creditAccounts={creditAccounts}
                adjustments={adjustments}
                transactions={transactions}
                config={config}
                userRole={currentUserRole || undefined}
                currentOrg={organizations.find(o => o.id === currentOrgId)}
                pendingRestocks={pendingRestocks}
                readNotificationIds={readNotificationIds}
                onMarkAsRead={(ids) => {
                  setReadNotificationIds(prev => Array.from(new Set([...prev, ...ids])));
                  markNotificationsAsRead(currentUserUid, ids, currentOrgId);
                }}
                onNavigate={(screen, tab) => {
                  if (screen === 'credit-new') {
                    setActiveScreen('credit');
                    setInitialOpenAddModal(true);
                  } else {
                    setActiveScreen(screen);
                    if (screen === 'settings' && tab) {
                      setSettingsTabOverride(tab as any);
                    }
                    if (screen === 'inventory' && tab) {
                      setInventoryTabOverride(tab as any);
                    }
                  }
                }}
              />
            )}

            {activeScreen === 'inventory' && (
              <InventoryScreen
                inventory={inventory}
                adjustments={adjustments}
                config={config}
                businessId={currentOrgId}
                userUid={currentUserUid}
                onAddItem={handleAddItem}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onLogAdjustment={handleLogAdjustment}
                userRole={currentUserRole || undefined}
                pendingRestocks={pendingRestocks}
                onVerifyRestock={handleVerifyRestock}
                inventoryTabOverride={inventoryTabOverride}
                onClearInventoryTabOverride={() => setInventoryTabOverride(null)}
              />
            )}

            {activeScreen === 'credit' && (
              <CreditScreen
                creditAccounts={creditAccounts}
                transactions={transactions}
                config={config}
                inventory={inventory}
                adjustments={adjustments}
                onAddAccount={handleAddAccount}
                onAddTransaction={handleAddTransaction}
                onSettleAccount={handleSettleAccount}
                initialOpenAddModal={initialOpenAddModal}
                onClearInitialOpenAddModal={() => setInitialOpenAddModal(false)}
                userRole={currentUserRole || undefined}
              />
            )}

            {activeScreen === 'transactions' && (
              <TransactionsScreen
                adjustments={adjustments}
                transactions={transactions}
                inventory={inventory}
                creditAccounts={creditAccounts}
                config={config}
                onLogAdjustment={handleLogAdjustment}
                onAddTransaction={handleAddTransaction}
                onAddAccount={handleAddAccount}
                onFlagAdjustment={handleFlagAdjustment}
                onCorrectAdjustmentQty={handleCorrectAdjustmentQty}
                onFlagTransaction={handleFlagTransaction}
                onCorrectTransactionAmount={handleCorrectTransactionAmount}
                userRole={currentUserRole || undefined}
              />
            )}

            {activeScreen === 'report' && (
              <ReportScreen
                inventory={inventory}
                creditAccounts={creditAccounts}
                config={config}
                adjustments={adjustments}
                transactions={transactions}
                userRole={currentUserRole || undefined}
              />
            )}

            {activeScreen === 'invoice' && (
              <InvoiceGeneratorScreen
                inventory={inventory}
                creditAccounts={creditAccounts}
                adjustments={adjustments}
                transactions={transactions}
                config={config}
                onPersistInvoice={async (payload) => saveInvoice(currentOrgId, currentUserUid, payload)}
              />
            )}

            {activeScreen === 'activity_log' && currentUserRole === 2 && (
              <ActivityLogScreen
                adjustments={adjustments}
                transactions={transactions}
                inventory={inventory}
                creditAccounts={creditAccounts}
                config={config}
              />
            )}

            {activeScreen === 'settings' && (
              <SettingsScreen
                config={config}
                onUpdateConfig={handleUpdateConfig}
                onResetSeedData={handleResetSeedData}
                onWipeStorage={handleWipeStorage}
                onClearTransactions={handleClearTransactions}
                userRole={currentUserRole || undefined}
                currentOrgId={currentOrgId}
                organizations={organizations}
                onUpdateOrganizations={handleUpdateOrganizations}
                onGenerateInvite={handleGenerateInvite}
                settingsTabOverride={settingsTabOverride}
                onClearSettingsTabOverride={() => setSettingsTabOverride(null)}
              />
            )}

            <GeminiAssistantOverlay
              inventory={inventory}
              creditAccounts={creditAccounts}
              adjustments={adjustments}
              transactions={transactions}
              pendingRestocks={pendingRestocks}
              config={config}
              activeScreen={activeScreen}
              setActiveScreen={setActiveScreen}
              userRole={currentUserRole || undefined}
              setInventory={setInventory}
              setCreditAccounts={setCreditAccounts}
              setAdjustments={setAdjustments}
              setTransactions={setTransactions}
              setPendingRestocks={setPendingRestocks}
              setConfig={setConfig}
            />
          </Navigation>
        </CurrencyProvider>
      )}

      {isLoggedIn && currentUserRole === 5 && activeOrg?.isTempPassword && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md neumorphic-card rounded-2xl p-6 text-left border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/90 dark:bg-slate-900/90 text-slate-900 dark:text-white shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20">
                <Lock size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Temporary Passcode Detected</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Please update your passcode to secure your account.</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              You logged in using a temporary passcode PIN. For security purposes, you are required to establish a new, unique passcode before proceeding.
            </p>

            {tempPasscodeError && (
              <div className="bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-2.5 rounded-lg text-[10px] font-semibold mb-4 leading-relaxed flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{tempPasscodeError}</span>
              </div>
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              setTempPasscodeError('');
              const newPin = (e.currentTarget.elements.namedItem('newPin') as HTMLInputElement).value;
              const confirmPin = (e.currentTarget.elements.namedItem('confirmPin') as HTMLInputElement).value;

              if (!newPin.trim()) {
                setTempPasscodeError('Passcode cannot be empty.');
                return;
              }

              if (newPin !== confirmPin) {
                setTempPasscodeError('Confirm passcode does not match.');
                return;
              }

              if (activeOrg && newPin === activeOrg.adminPass) {
                setTempPasscodeError("For security, your secondary passcode PIN must be unique from the administrator's passcode PIN.");
                return;
              }

              if (activeOrg && newPin.trim() === activeOrg.attendantPass) {
                setTempPasscodeError("For security, your new passcode PIN cannot be the same as your temporary passcode.");
                return;
              }

              if (activeOrg && activeOrg.previousAttendantPass && newPin.trim() === activeOrg.previousAttendantPass) {
                setTempPasscodeError("For security, your new passcode PIN cannot be the same as your old passcode PIN.");
                return;
              }

              if (activeOrg) {
                // Save the updated passcode
                const updated = organizations.map(o => {
                  if (o.id === activeOrg.id) {
                    return {
                      ...o,
                      attendantPass: newPin.trim(),
                      isTempPassword: false
                    };
                  }
                  return o;
                });
                setOrganizations(updated);

                // Set temporary success message
                setSuccess('Passcode changed successfully! Enjoy full system access.');
                setTimeout(() => setSuccess(null), 4000);
              }
            }} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  New Passcode PIN
                </label>
                <input
                  name="newPin"
                  type="password"
                  required
                  placeholder="Enter your new PIN..."
                  className="w-full neumorphic-inset rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm New Passcode PIN
                </label>
                <input
                  name="confirmPin"
                  type="password"
                  required
                  placeholder="Retype your new PIN..."
                  className="w-full neumorphic-inset rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-medium"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl neumorphic-btn flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shadow-md border border-white/30 dark:border-slate-700/60"
              >
                <Check size={14} /> Update & Complete Sign In
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {showCodeVerificationModal && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/90 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md neumorphic-card rounded-2xl p-6 text-left border border-slate-200/80 dark:border-slate-800/80 bg-slate-100/90 dark:bg-slate-900/90 text-slate-900 dark:text-white shadow-2xl relative overflow-hidden"
          >
            {/* Countdown Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 neumorphic-inset">
              <span className={`w-1.5 h-1.5 rounded-full ${timeRemainingText === 'Expired' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
              <span className={`text-[10px] font-mono font-bold ${timeRemainingText === 'Expired' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {timeRemainingText === 'Expired' ? 'EXPIRED' : `EXPIRES IN: ${timeRemainingText}`}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4 pr-24">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
                <Shield size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Verification Code Required</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Please check your email for the temporary PIN.</p>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              A temporary passcode reset is active for your account. Please enter the temporary PIN. <strong>This verification session will expire in 5 minutes.</strong>
            </p>

            {(() => {
              const activeResetOrg = organizations.find(o => o.id === verificationOrgId);
              if (activeResetOrg) {
                return (
                  <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 rounded-lg p-3 text-xs mb-4 text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">Simulated Email to {activeResetOrg.attendantResetEmail || 'zarsamuel105@gmail.com'}:</span>
                    <p className="mt-1 text-[11px]">Hello, a temporary passcode reset has been requested for your attendant account. Use the following temporary PIN to verify your identity:</p>
                    <div className="mt-2 text-center">
                      <span className="font-mono text-lg font-bold text-slate-900 dark:text-white tracking-widest bg-white dark:bg-slate-950 px-3 py-1 rounded border border-slate-200 dark:border-slate-800 neumorphic-inset inline-block">
                        {activeResetOrg.attendantPass}
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Temporary Passcode PIN
                </label>
                <input
                  type="password"
                  required
                  disabled={timeRemainingText === 'Expired'}
                  placeholder="Enter the temporary passcode..."
                  value={verificationCodeInput}
                  onChange={(e) => {
                    setVerificationCodeInput(e.target.value);
                    if (verificationError) setVerificationError('');
                  }}
                  className="w-full neumorphic-inset rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-slate-200/80 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/80 font-mono font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {verificationSuccess && (
                <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-[10px] font-semibold leading-relaxed">
                  {verificationSuccess}
                </div>
              )}

              {verificationError && (
                <div className="bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-2.5 rounded-lg text-[10px] font-semibold leading-relaxed">
                  {verificationError}
                </div>
              )}

              <div className="flex justify-end pr-1">
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResendPINClick}
                  className="text-[11px] font-semibold text-sky-600 dark:text-indigo-400 hover:text-sky-700 dark:hover:text-indigo-300 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                >
                  {resendCooldown > 0 ? (
                    <span>Resend PIN in {resendCooldown}s</span>
                  ) : (
                    <span>Request another PIN</span>
                  )}
                </button>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowCodeVerificationModal(false);
                    setVerificationCodeInput('');
                    setVerificationError('');
                    setVerificationSuccess('');
                  }}
                  className="w-1/2 py-2.5 px-4 neumorphic-btn bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={timeRemainingText === 'Expired'}
                  className="w-1/2 py-2.5 px-4 bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl neumorphic-btn flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shadow-md border border-white/30 dark:border-slate-700/60 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Verify & Log In
                </button>
              </div>
            </form>


          </motion.div>
        </div>
      )}

    </>
  );
}