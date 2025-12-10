/**
 * Blog API hooks
 * React Query hooks for blog CRUD operations
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

// Query keys
export const blogKeys = {
  all: ["blogs"] as const,
  lists: () => [...blogKeys.all, "list"] as const,
  details: () => [...blogKeys.all, "detail"] as const,
  detail: (slug: string) => [...blogKeys.details(), slug] as const,
};

// Types
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
}

// Hooks
export function useBlogs() {
  return useQuery({
    queryKey: blogKeys.lists(),
    queryFn: () => api.get<BlogPost[]>("/blogs"),
  });
}

export function useBlog(slug: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: blogKeys.detail(slug),
    queryFn: () => api.get<BlogPost>(`/blogs/${slug}`),
    enabled: options?.enabled !== undefined ? options.enabled && !!slug : !!slug,
  });
}
