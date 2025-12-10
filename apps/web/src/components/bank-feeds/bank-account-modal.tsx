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
import { useForm } from "react-hook-form";
import { DatabaseIcon } from "@/assets/icons";
import { FormInput } from "@/components/ui/form/form-input";
import { zodResolver } from "@/lib/utils";
import { Form } from "@/components/ui/form/form";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { z } from "zod";
import { useCreateBankAccount } from "@/api/bank-feed";

interface BankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const createAccountSchema = z.object({
  accountName: z.string().min(1, "Account name is required").max(100),
  bankName: z.string().max(100).optional(),
  accountNumber: z.string().max(50).optional(),
  currency: z.string().length(3).default("MYR"),
  openingBalance: z.string().optional(),
});

type CreateAccountSchema = z.infer<typeof createAccountSchema>;

export function BankAccountModal({ isOpen, onClose }: BankAccountModalProps) {
  const form = useForm<CreateAccountSchema>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      accountName: "",
      bankName: "",
      accountNumber: "",
      currency: "MYR",
      openingBalance: "0",
    },
  });

  const createMutation = useCreateBankAccount();

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (data: CreateAccountSchema) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Bank account created successfully");
        handleClose();
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeaderContainer>
              <DialogIcon>
                <DatabaseIcon />
              </DialogIcon>
              <DialogHeader>
                <DialogTitle>Add Bank Account</DialogTitle>
                <DialogDescription>
                  Add a bank account to import statements and reconcile transactions.
                </DialogDescription>
              </DialogHeader>
            </DialogHeaderContainer>
            <DialogContentContainer>
              <div className="space-y-4">
                <FormInput
                  label="Account Name"
                  name="accountName"
                  placeholder="e.g. Main Business Account"
                  reactform={form}
                  description="A name to identify this account"
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Bank Name"
                    name="bankName"
                    placeholder="e.g. Maybank"
                    reactform={form}
                    isOptional
                  />
                  <FormInput
                    label="Account Number"
                    name="accountNumber"
                    placeholder="e.g. 512345678901"
                    reactform={form}
                    isOptional
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Currency"
                    name="currency"
                    placeholder="MYR"
                    reactform={form}
                    description="3-letter code"
                  />
                  <FormInput
                    label="Opening Balance"
                    name="openingBalance"
                    placeholder="0.00"
                    reactform={form}
                    isOptional
                  />
                </div>
              </div>
            </DialogContentContainer>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={createMutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Add Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
