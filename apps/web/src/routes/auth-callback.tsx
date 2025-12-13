import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "@/data/auth";

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { error } = await authService.getSession();

      if (error) {
        console.error("Auth callback error:", error);
        void navigate("/");
        return;
      }

      // Successfully authenticated, redirect to dashboard
      void navigate("/invoices");
    };

    void handleAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
