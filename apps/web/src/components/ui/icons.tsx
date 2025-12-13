/**
 * Centralized icon exports using Phosphor Icons
 * This file provides a consistent icon API across the application
 *
 * Migrated from lucide-react to @phosphor-icons/react
 */

import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

// Re-export the Icon type for components that need it
export type LucideIcon = PhosphorIcon;
export type IconProps = PhosphorIcon;

export {
  // Alerts & Status
  WarningCircle as AlertCircle,
  WarningCircle as AlertCircleIcon,
  Warning as AlertTriangle,
  Warning as AlertTriangleIcon,
  Warning as TriangleAlertIcon,
  Info,
  Info as InfoIcon,
  CheckCircle,
  CheckCircle as CheckCircle2,
  CheckCircle as CheckCircleIcon,
  CheckCircle as CheckCircle2Icon,
  XCircle,
  XCircle as XCircleIcon,
  Check,
  Check as CheckIcon,
  X,
  X as XIcon,
  ShieldCheck,
  Bell as BellIcon,
  Question as HelpCircleIcon,

  // Arrows & Navigation
  ArrowLeft,
  ArrowRight,
  ArrowRight as ArrowRightIcon,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  ArrowsLeftRight as ArrowRightLeft,
  ArrowsLeftRight as ArrowLeftRight,
  ArrowsDownUp as ArrowUpDownIcon,
  ArrowDownLeft,
  ArrowCircleUp as ArrowUpCircleIcon,
  CaretDown as ChevronDown,
  CaretDown as ChevronDownIcon,
  CaretUp as ChevronUp,
  CaretUp as ChevronUpIcon,
  CaretLeft as ChevronLeft,
  CaretLeft as ChevronLeftIcon,
  CaretRight as ChevronRight,
  CaretRight as ChevronRightIcon,
  CaretDoubleLeft as ChevronsLeftIcon,
  CaretDoubleRight as ChevronsRightIcon,
  CaretUpDown as ChevronsUpDown,
  ArrowCounterClockwise as Undo2Icon,
  ArrowsClockwise as RefreshCw,
  ArrowsClockwise as RefreshCwIcon,

  // Sorting
  SortDescending as ArrowDownZaIcon,
  SortAscending as ArrowUpZaIcon,

  // Files & Documents
  FileText,
  FileText as FileTextIcon,
  FilePlus,
  FileMinus,
  File as FileIcon,
  FileCode as FileCodeIcon,
  FilePdf as FileEdit,
  FileArrowDown as FileDown,
  FileXls as FileSpreadsheet,
  Folder as FolderIcon,
  Receipt,

  // Actions
  Plus,
  Plus as PlusIcon,
  PlusCircle as PlusCircleIcon,
  Minus,
  Pencil,
  PenNib as PenTool,
  Trash as Trash2,
  Trash as Trash2Icon,
  Copy,
  Download,
  Upload,
  MagnifyingGlass as SearchIcon,
  PaperPlaneTilt as Send,
  PaperPlaneTilt as SendIcon,
  Eye,
  Eye as EyeIcon,
  ArrowSquareOut as ExternalLink,
  SignOut as LogOut,
  SignOut as LogOutIcon,
  Link,
  ShareNetwork as ShareIcon,
  Lock,
  Paperclip,

  // UI Elements
  DotsThree as Ellipsis,
  DotsThreeOutline as MoreHorizontal,
  DotsThreeOutline as MoreHorizontalIcon,
  DotsThreeVertical as MoreVertical,
  DotsThreeVertical as MoreVerticalIcon,
  DotsSixVertical as GripVerticalIcon,
  SidebarSimple as PanelLeftIcon,
  Circle as CircleIcon,
  Columns as ColumnsIcon,
  List as ListIcon,
  ListDashes as LayoutListIcon,
  ClipboardText as ClipboardListIcon,
  SquaresFour as LayoutDashboardIcon,
  GridFour as LayoutGridIcon,
  Wrench,
  Gear as Settings,
  Gear as SettingsIcon,
  Calculator,
  Scales as Scale,

  // Objects & Concepts
  House as Home,
  Buildings as Building2,
  User,
  User as UserIcon,
  Users,
  Users as UsersIcon,
  UserCircle as UserCircleIcon,
  Envelope as Mail,
  Envelope as MailIcon,
  Phone,
  MapPin,
  Globe,
  Calendar,
  Calendar as CalendarIcon,
  Clock,
  Clock as ClockIcon,
  CreditCard,
  CreditCard as CreditCardIcon,
  CurrencyDollar as DollarSign,
  CurrencyDollar as CurrencyDollarIcon,
  Package,
  Image as ImageIcon,
  Camera as CameraIcon,
  Hash,
  BookOpen,
  Robot as Bot,
  Sparkle as Sparkles,
  Sparkle as SparklesIcon,
  Wallet,
  Database as DatabaseIcon,
  ChartBar as BarChartIcon,
  ChartBar as BarChart3,
  ChartPie as PieChart,

  // Charts & Trends
  TrendUp as TrendingUp,
  TrendUp as TrendingUpIcon,
  TrendDown as TrendingDown,
  TrendDown as TrendingDownIcon,

  // Theme
  Sun as SunIcon,
  Moon as MoonIcon,

  // Loading
  CircleNotch as Loader2,
  CircleNotch as Loader2Icon,
  CircleNotch as LoaderCircleIcon,
  CircleNotch as LoaderIcon,

  // Additional aliases
  CheckCircle as CircleCheckIcon,
  MagnifyingGlass as Search,
  XCircle as OctagonXIcon,

  // Missing icons
  Image,
  FloppyDisk as Save,
  FloppyDisk as SaveIcon,
  FloppyDisk as FloppyDiskIcon,
  Cloud,
  Funnel as Filter,
  ClipboardText as ClipboardList,
  Lightning as Zap,
  Lightning as ZapIcon,
  Brain,
  WifiSlash as WifiOff,
  WifiSlash as WifiOffIcon,
  DeviceMobile as SmartphoneIcon,
  Download as DownloadIcon,

  // Developer Portal
  Code as Code2,
  Key,
  WebhooksLogo as Webhook,
  Terminal as TerminalIcon,

  // Additional icons
  Play,
  Play as PlayIcon,
  Prohibit as Ban,
  Pencil as Edit,
  PencilSimple as EditIcon,

  // Agent/Workflow icons
  Shield,
  StopCircle,
  StopCircle as StopCircleIcon,
  Pause,
  ArrowCounterClockwise as RotateCcw,
  Pulse as Activity,
  ChatCircle as MessageSquare,

  // Employee/HR icons
  UserCheck,
  UserCheck as UserCheckIcon,
  UserMinus,
  UserMinus as UserXIcon,
  SunHorizon as SunsetIcon,

  // Payroll workflow icons
  ClipboardText as ClipboardIcon,
  CirclesFour as CirclesIcon,
  CurrencyCircleDollar as MoneyIcon,
  Coins as CoinsIcon,
  ChartLineUp as ChartIcon,
  Handshake as HandshakeIcon,
  Bank as BankIcon,
} from "@phosphor-icons/react";
