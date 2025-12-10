import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocation, Link } from "react-router-dom";
import { ChevronRight } from "@/components/ui/icons";

import { type ISidebarItem } from "@/types";

export function NavigationItem({ title, items }: { title: string; items: ISidebarItem[] }) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="select-none">{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = pathname === item.url;
          const hasChildren = item.children && item.children.length > 0;
          const isChildActive = hasChildren && item.children?.some((child) => pathname === child.url);

          if (hasChildren) {
            return (
              <Collapsible
                key={item.name}
                asChild
                defaultOpen={isActive || isChildActive}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isActive || isChildActive}>
                      <span className="flex items-center justify-center [&>svg]:size-4">{item.icon}</span>
                      <span className="text-[13px] font-medium tracking-tighter">{item.name}</span>
                      <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* Main item as first sub-item */}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={isActive}>
                          <Link to={item.url}>
                            <span className="text-[13px]">All {item.name}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {/* Child items */}
                      {item.children?.map((child) => {
                        const isSubActive = pathname === child.url;
                        return (
                          <SidebarMenuSubItem key={child.name}>
                            <SidebarMenuSubButton asChild isActive={isSubActive}>
                              <Link to={child.url}>
                                {child.icon && <span className="flex items-center justify-center [&>svg]:size-3.5">{child.icon}</span>}
                                <span className="text-[13px]">{child.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          }

          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton asChild isActive={isActive}>
                <Link to={item.url}>
                  <span className="flex items-center justify-center [&>svg]:size-4">{item.icon}</span>
                  <span className="text-[13px] font-medium tracking-tighter">{item.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
