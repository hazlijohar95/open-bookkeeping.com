import * as React from "react";
import { Link } from "react-router-dom";
import { ShieldIcon } from "@/components/ui/icons";

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
import { SUPERADMIN_SIDEBAR } from "@/constants/superadmin-sidebar";
import { LINKS } from "@/constants/links";
import { Button } from "@/components/ui/button";

export function SuperadminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { Overview, ...restItems } = SUPERADMIN_SIDEBAR;

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader className="pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-secondary-foreground select-none"
              variant="default"
              size="lg"
              asChild
            >
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldIcon className="size-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">Superadmin</span>
                  <span className="text-xs text-muted-foreground">Platform Control</span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Overview section */}
        {Overview && <NavigationItem title="Overview" items={Overview} />}

        <SidebarSeparator className="my-1" />

        {/* Rest of navigation */}
        {Object.keys(restItems).map((key) => (
          <NavigationItem key={key} title={key} items={restItems[key]!} />
        ))}

        <SidebarSeparator className="my-1" />

        {/* Back to App */}
        <div className="px-3 py-2">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link to={LINKS.DASHBOARD}>
              Back to App
            </Link>
          </Button>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-2">
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Superadmin Access
            </p>
            <p className="text-xs text-muted-foreground">
              All actions are logged
            </p>
          </div>
        </div>
        <NavigationUser />
      </SidebarFooter>
    </Sidebar>
  );
}
