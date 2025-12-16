/**
 * Hook to check user role and permissions
 */

import { trpc } from "@/trpc/provider";
import { useAuth } from "@/providers/auth-provider";

export type UserRole = "superadmin" | "admin" | "user" | "viewer";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isSuspended: boolean;
}

/**
 * Fetches the current user's information including role from the backend
 */
export function useCurrentUser() {
  const { user: authUser } = useAuth();

  return trpc.settings.getCurrentUser.useQuery(undefined, {
    enabled: !!authUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Returns role-related information and helpers
 */
export function useUserRole() {
  const { data: currentUser, isLoading, error } = useCurrentUser();

  const role: UserRole = (currentUser?.role as UserRole) ?? "user";

  return {
    role,
    isLoading,
    error,
    isSuperadmin: role === "superadmin",
    isAdmin: role === "superadmin" || role === "admin",
    isUser: role === "user",
    isViewer: role === "viewer",
    hasRole: (requiredRole: UserRole) => {
      const roleHierarchy: Record<UserRole, number> = {
        superadmin: 4,
        admin: 3,
        user: 2,
        viewer: 1,
      };
      return roleHierarchy[role] >= roleHierarchy[requiredRole];
    },
  };
}

/**
 * Check if current user can access superadmin features
 */
export function useIsSuperadmin() {
  const { isSuperadmin, isLoading } = useUserRole();
  return { isSuperadmin, isLoading };
}
