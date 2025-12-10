import { useAuth } from "@/providers/auth-provider";

export const useUser = () => {
  const { user } = useAuth();
  return user;
};
