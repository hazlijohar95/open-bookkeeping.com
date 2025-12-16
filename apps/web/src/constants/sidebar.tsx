import {
  GaugeIcon,
  VersionsIcon,
  FileFeatherIcon,
  UsersIcon,
  TruckIcon,
  BookOpenIcon,
  FolderFeatherIcon,
  BoxIcon,
  GearIcon,
  ReceiptIcon,
  DatabaseIcon,
  FileMinusIcon,
  FilePlusIcon,
  ScaleIcon,
  TrendingUpIcon,
  BuildingIcon,
  CodeIcon,
  KeyIcon,
  WebhookIcon,
  FilePenIcon,
  WarehouseIcon,
  SparklesIcon,
  FileTreeIcon,
} from "@/assets/icons";
import type { ISidebar } from "@/types";
import { LINKS } from "./links";

export const SIDEBAR_ITEMS: ISidebar = {
  // Dashboard - primary entry point
  Overview: [
    {
      name: "Dashboard",
      url: LINKS.DASHBOARD,
      icon: <GaugeIcon />,
    },
    {
      name: "AI Co-Worker",
      url: LINKS.AGENT,
      icon: <SparklesIcon />,
    },
  ],

  // Sales - Money coming in (Quote → Invoice → Get Paid)
  Sales: [
    {
      name: "Invoices",
      url: LINKS.INVOICES,
      icon: <VersionsIcon />,
      children: [
        {
          name: "Quotations",
          url: LINKS.QUOTATIONS,
          icon: <FileFeatherIcon />,
        },
        {
          name: "Credit Notes",
          url: LINKS.CREDIT_NOTES,
          icon: <FileMinusIcon />,
        },
        {
          name: "Debit Notes",
          url: LINKS.DEBIT_NOTES,
          icon: <FilePlusIcon />,
        },
      ],
    },
    {
      name: "Statements",
      url: LINKS.STATEMENTS,
      icon: <BookOpenIcon />,
    },
  ],

  // Purchases - Money going out
  Purchases: [
    {
      name: "Bills",
      url: LINKS.BILLS,
      icon: <ReceiptIcon />,
    },
  ],

  // Contacts - People you do business with
  Contacts: [
    {
      name: "Customers",
      url: LINKS.CUSTOMERS,
      icon: <UsersIcon />,
    },
    {
      name: "Vendors",
      url: LINKS.VENDORS,
      icon: <TruckIcon />,
    },
  ],

  // Banking - Transaction reconciliation
  Banking: [
    {
      name: "Bank Feeds",
      url: LINKS.BANK_FEEDS,
      icon: <DatabaseIcon />,
    },
  ],

  // Payroll - Employee management and salary processing
  Payroll: [
    {
      name: "Employees",
      url: LINKS.EMPLOYEES,
      icon: <UsersIcon />,
    },
    {
      name: "Payroll Runs",
      url: LINKS.PAYROLL_RUNS,
      icon: <ReceiptIcon />,
    },
  ],

  // Accounting - Chart of accounts, journal entries, and fixed assets
  Accounting: [
    {
      name: "Chart of Accounts",
      url: LINKS.CHART_OF_ACCOUNTS,
      icon: <BookOpenIcon />,
      children: [
        {
          name: "Journal Entries",
          url: LINKS.JOURNAL_ENTRIES,
          icon: <FilePenIcon />,
        },
      ],
    },
    {
      name: "Fixed Assets",
      url: LINKS.FIXED_ASSETS,
      icon: <WarehouseIcon />,
    },
  ],

  // Reports - Financial statements and compliance
  Reports: [
    {
      name: "Profit & Loss",
      url: LINKS.PROFIT_LOSS,
      icon: <TrendingUpIcon />,
    },
    {
      name: "Balance Sheet",
      url: LINKS.BALANCE_SHEET,
      icon: <BuildingIcon />,
    },
    {
      name: "Trial Balance",
      url: LINKS.TRIAL_BALANCE,
      icon: <ScaleIcon />,
    },
    {
      name: "SST Reports",
      url: LINKS.SST,
      icon: <ReceiptIcon />,
    },
  ],

  // Tools - Utilities and integrations
  Tools: [
    {
      name: "Document Vault",
      url: LINKS.VAULT,
      icon: <FolderFeatherIcon />,
    },
    {
      name: "Developer",
      url: LINKS.DEVELOPER,
      icon: <CodeIcon />,
      children: [
        {
          name: "API Keys",
          url: LINKS.DEVELOPER_API_KEYS,
          icon: <KeyIcon />,
        },
        {
          name: "Webhooks",
          url: LINKS.DEVELOPER_WEBHOOKS,
          icon: <WebhookIcon />,
        },
        {
          name: "Data Flow",
          url: LINKS.DATA_FLOW,
          icon: <FileTreeIcon />,
        },
      ],
    },
  ],

  // Account - UserIcon settings
  Account: [
    {
      name: "Settings",
      url: LINKS.SETTINGS,
      icon: <GearIcon />,
      children: [
        {
          name: "Brand Assets",
          url: LINKS.ASSETS,
          icon: <BoxIcon />,
        },
      ],
    },
  ],
};
