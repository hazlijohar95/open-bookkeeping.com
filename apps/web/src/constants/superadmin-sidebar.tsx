import {
  GaugeIcon,
  UsersIcon,
  BuildingIcon,
  TrendingUpIcon,
  SparklesIcon,
  GearIcon,
  FileIcon,
  CreditCardIcon,
  DollarSignIcon,
} from "@/components/ui/icons";
import type { ISidebar } from "@/types";
import { LINKS } from "./links";

/**
 * Sidebar configuration for the superadmin dashboard
 */
export const SUPERADMIN_SIDEBAR: ISidebar = {
  Overview: [
    {
      name: "Dashboard",
      url: LINKS.SUPERADMIN.DASHBOARD,
      icon: <GaugeIcon className="size-4" />,
    },
  ],

  Users: [
    {
      name: "All Users",
      url: LINKS.SUPERADMIN.USERS,
      icon: <UsersIcon className="size-4" />,
    },
    {
      name: "Organizations",
      url: LINKS.SUPERADMIN.ORGANIZATIONS,
      icon: <BuildingIcon className="size-4" />,
    },
  ],

  Platform: [
    {
      name: "Analytics",
      url: LINKS.SUPERADMIN.ANALYTICS,
      icon: <TrendingUpIcon className="size-4" />,
    },
    {
      name: "AI Co-Worker",
      url: LINKS.SUPERADMIN.AGENT,
      icon: <SparklesIcon className="size-4" />,
    },
  ],

  Billing: [
    {
      name: "Subscriptions",
      url: LINKS.SUPERADMIN.SUBSCRIPTIONS,
      icon: <CreditCardIcon className="size-4" />,
    },
    {
      name: "Revenue",
      url: LINKS.SUPERADMIN.REVENUE,
      icon: <DollarSignIcon className="size-4" />,
    },
  ],

  System: [
    {
      name: "Settings",
      url: LINKS.SUPERADMIN.SETTINGS,
      icon: <GearIcon className="size-4" />,
    },
    {
      name: "Audit Logs",
      url: LINKS.SUPERADMIN.AUDIT_LOGS,
      icon: <FileIcon className="size-4" />,
    },
  ],
};
