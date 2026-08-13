import React from 'react';
import {
  LayoutDashboard,
  Package,
  Coins,
  Receipt,
  BarChart3,
  Shield,
  FileText,
  History,
  Filter,
  Flag,
  User,
  Sliders,
  Camera,
  Save,
  Globe,
  Repeat,
  Database,
  AlertTriangle,
  Trash2,
  RotateCcw,
  Key,
  PieChart,
  Calendar,
  Zap,
  CreditCard,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Building,
  Sparkles,
  CheckCircle,
  Plus,
  Minus,
  Edit3,
  X,
  Settings,
  LogOut,
  ChevronDown,
  Wallet,
  Store,
  ShieldCheck,
  HelpCircle,
  Search,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Bell,
  Mail,
  Smartphone,
  Check
} from 'lucide-react';

interface MaterialIconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  dashboard: LayoutDashboard,
  inventory: Package,
  inventory_2: Package,
  payments: Coins,
  receipt_long: Receipt,
  bar_chart: BarChart3,
  shield: Shield,
  description: FileText,
  history: History,
  filter_alt: Filter,
  flag: Flag,
  person: User,
  tune: Sliders,
  security: Shield,
  photo_camera: Camera,
  save: Save,
  public: Globe,
  currency_exchange: Repeat,
  database: Database,
  warning: AlertTriangle,
  delete_sweep: Trash2,
  restart_alt: RotateCcw,
  key: Key,
  pie_chart: PieChart,
  calendar_month: Calendar,
  bolt: Zap,
  credit_card: CreditCard,
  trending_up: TrendingUp,
  trending_down: TrendingDown,
  north_east: ArrowUpRight,
  south_east: ArrowDownRight,
  error_outline: AlertCircle,
  domain: Building,
  auto_awesome: Sparkles,
  check_circle: CheckCircle,
  add: Plus,
  remove: Minus,
  edit: Edit3,
  close: X,
  settings: Settings,
  logout: LogOut,
  outbound: ArrowUpRight,
  expand_more: ChevronDown,
  account_balance_wallet: Wallet,
  storefront: Store,
  verified_user: ShieldCheck,
  settings_backup_restore: RotateCcw,
  help: HelpCircle,
  search: Search,
  lock: Lock,
  unlock: Unlock,
  visibility: Eye,
  visibility_off: EyeOff,
  notifications: Bell,
  mail: Mail,
  smartphone: Smartphone,
  check: Check
};

export default function MaterialIcon({ name, className = '', filled = false, size }: MaterialIconProps) {
  const Component = iconMap[name];

  if (Component) {
    return <Component size={size || 18} className={className} />;
  }

  // Fallback to Google Fonts Material Symbols if unmapped name
  const style = size ? { fontSize: `${size}px` } : undefined;
  return (
    <span 
      className={`material-symbols-rounded select-none inline-flex items-center justify-center leading-none ${filled ? 'material-symbols-filled' : ''} ${className}`}
      style={{ fontFamily: "'Material Symbols Rounded', 'Material Symbols Outlined', sans-serif !important", ...style }}
    >
      {name}
    </span>
  );
}
