import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogContentContainer,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/provider";
import { toast } from "sonner";
import { Sparkles, CheckCircle2Icon } from "@/components/ui/icons";

interface InitializeDefaultsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InitializeDefaultsModal({
  isOpen,
  onClose,
}: InitializeDefaultsModalProps) {
  const utils = trpc.useUtils();

  const initializeMutation =
    trpc.chartOfAccounts.initializeDefaults.useMutation({
      onSuccess: (result) => {
        void utils.chartOfAccounts.checkHasAccounts.invalidate();
        void utils.chartOfAccounts.getAccountTree.invalidate();
        void utils.chartOfAccounts.getAccountSummary.invalidate();
        toast.success(
          `Successfully created ${result.accountsCreated} accounts`
        );
        onClose();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  const handleInitialize = () => {
    initializeMutation.mutate();
  };

  const features = [
    "Assets (Current & Fixed) - Bank accounts, receivables, equipment",
    "Liabilities - Payables, SST, EPF, SOCSO, EIS, PCB",
    "Equity - Share capital, retained earnings",
    "Revenue - Sales, services, other income",
    "Expenses - COGS, operating, professional fees",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeaderContainer>
          <DialogIcon>
            <Sparkles className="size-5" />
          </DialogIcon>
          <DialogHeader>
            <DialogTitle>Load Malaysian SME Defaults</DialogTitle>
            <DialogDescription>
              Initialize your chart of accounts with accounts commonly used by
              Malaysian SMEs, including SST and statutory contribution accounts.
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogContentContainer>
          <div className="space-y-3">
            <div className="text-sm font-medium">What's included:</div>
            <ul className="space-y-2">
              {features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle2Icon className="size-4 text-success mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3 mt-4">
              You can customize, add, or remove accounts after initialization.
              System accounts (AR, AP, SST) cannot be deleted.
            </div>
          </div>
        </DialogContentContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={initializeMutation.isPending}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleInitialize}
            disabled={initializeMutation.isPending}
          >
            {initializeMutation.isPending ? (
              <>
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Initializing...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Initialize Accounts
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
