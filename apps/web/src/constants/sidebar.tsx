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
} from "@/assets/icons";
import { FileMinus, FilePlus, BookOpen, Receipt, Scale, TrendingUp, Building2, FileText } from "@/components/ui/icons";
import type { ISidebar } from "@/types";
import { LINKS } from "./links";

export const SIDEBAR_ITEMS: ISidebar = {
  Overview: [
    {
      name: "Dashboard",
      url: LINKS.DASHBOARD,
      icon: <GaugeIcon />,
    },
  ],
  Revenue: [
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
          icon: <FileMinus className="size-4" />,
        },
        {
          name: "Debit Notes",
          url: LINKS.DEBIT_NOTES,
          icon: <FilePlus className="size-4" />,
        },
        {
          name: "Statements",
          url: LINKS.STATEMENTS,
          icon: <BookOpenIcon />,
        },
        {
          name: "Assets",
          url: LINKS.ASSETS,
          icon: <BoxIcon />,
        },
      ],
    },
    {
      name: "Bills",
      url: LINKS.BILLS,
      icon: <ReceiptIcon />,
    },
  ],
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
  Banking: [
    {
      name: "Bank Feeds",
      url: LINKS.BANK_FEEDS,
      icon: <DatabaseIcon />,
    },
    {
      name: "Chart of Accounts",
      url: LINKS.CHART_OF_ACCOUNTS,
      icon: <BookOpen className="size-4" />,
      children: [
        {
          name: "Journal Entries",
          url: LINKS.JOURNAL_ENTRIES,
          icon: <FileText className="size-4" />,
        },
      ],
    },
  ],
  Reports: [
    {
      name: "Trial Balance",
      url: LINKS.TRIAL_BALANCE,
      icon: <Scale className="size-4" />,
    },
    {
      name: "Profit & Loss",
      url: LINKS.PROFIT_LOSS,
      icon: <TrendingUp className="size-4" />,
    },
    {
      name: "Balance Sheet",
      url: LINKS.BALANCE_SHEET,
      icon: <Building2 className="size-4" />,
    },
    {
      name: "SST Reports",
      url: LINKS.SST,
      icon: <Receipt className="size-4" />,
    },
  ],
  Storage: [
    {
      name: "Vault",
      url: LINKS.VAULT,
      icon: <FolderFeatherIcon />,
    },
  ],
  Account: [
    {
      name: "Settings",
      url: LINKS.SETTINGS,
      icon: <GearIcon />,
    },
  ],
};
