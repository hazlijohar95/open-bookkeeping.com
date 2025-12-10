import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NavigationUser } from "@/components/layout/sidebar/navigation-user";
import { NavigationItem } from "@/components/layout/sidebar/navigation-item";
import { CreateInvoiceCTA } from "@/components/layout/sidebar/create-invoice-cta";
import { LogoBrandBracket } from "@/components/brand/logo-brand";
import OpenSourceBadge from "@/components/ui/open-source-badge";
import { SIDEBAR_ITEMS } from "@/constants/sidebar";

export function DashboardSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Separate Overview from other items to insert CTA after it
  const { Overview, ...restItems } = SIDEBAR_ITEMS;

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-secondary-foreground select-none" variant="default" size="lg" asChild>
              <div className="flex items-center">
                <LogoBrandBracket asLink={false} />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {/* Overview section */}
        {Overview && <NavigationItem title="Overview" items={Overview} />}

        {/* Signature Create Invoice CTA */}
        <CreateInvoiceCTA />

        <SidebarSeparator className="my-1" />

        {/* Rest of navigation */}
        {Object.keys(restItems).map((key) => (
          <NavigationItem key={key} title={key} items={restItems[key]!} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <OpenSourceBadge />
        <NavigationUser />
      </SidebarFooter>
    </Sidebar>
  );
}
