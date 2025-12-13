/**
 * Matching Rules Sheet
 * Allows users to create and manage transaction matching rules
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Settings,
  Plus,
  Trash2Icon,
  UserIcon,
  Building2,
  LayoutListIcon,
} from "@/components/ui/icons";
import {
  useMatchingRules,
  useCreateRule,
  useDeleteRule,
  type MatchingRule,
} from "@/api/bank-feed";
import { useCustomers } from "@/api/customers";
import { useVendors } from "@/api/vendors";

interface MatchingRulesSheetProps {
  trigger?: React.ReactNode;
}

export function MatchingRulesSheet({ trigger }: MatchingRulesSheetProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    descriptionContains: "",
    amountMin: "",
    amountMax: "",
    transactionType: "" as "deposit" | "withdrawal" | "",
    actionType: "" as "match_customer" | "match_vendor" | "categorize" | "",
    customerId: "",
    vendorId: "",
  });

  const { data: rules, isLoading } = useMatchingRules();
  const { data: customers } = useCustomers();
  const { data: vendors } = useVendors();
  const createRuleMutation = useCreateRule();
  const deleteRuleMutation = useDeleteRule();

  const resetForm = () => {
    setFormData({
      name: "",
      descriptionContains: "",
      amountMin: "",
      amountMax: "",
      transactionType: "",
      actionType: "",
      customerId: "",
      vendorId: "",
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    if (!formData.name || !formData.actionType) {
      toast.error("Please fill in required fields");
      return;
    }

    const conditions: MatchingRule["conditions"] = {};
    if (formData.descriptionContains) {
      conditions.descriptionContains = formData.descriptionContains.split(",").map((s) => s.trim());
    }
    if (formData.amountMin) {
      conditions.amountMin = parseFloat(formData.amountMin);
    }
    if (formData.amountMax) {
      conditions.amountMax = parseFloat(formData.amountMax);
    }
    if (formData.transactionType) {
      conditions.transactionType = formData.transactionType;
    }

    const action: MatchingRule["action"] = {
      type: formData.actionType,
    };
    if (formData.actionType === "match_customer" && formData.customerId) {
      action.customerId = formData.customerId;
    }
    if (formData.actionType === "match_vendor" && formData.vendorId) {
      action.vendorId = formData.vendorId;
    }

    createRuleMutation.mutate(
      {
        name: formData.name,
        conditions,
        action,
      },
      {
        onSuccess: () => {
          toast.success("Rule created successfully");
          resetForm();
        },
        onError: (error) => {
          toast.error(error.message);
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteRuleMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Rule deleted");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case "match_customer":
        return <UserIcon className="size-4 text-info" />;
      case "match_vendor":
        return <Building2 className="size-4 text-primary" />;
      case "categorize":
        return <LayoutListIcon className="size-4 text-success" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: MatchingRule["action"]) => {
    switch (action.type) {
      case "match_customer":
        return `Match to Customer`;
      case "match_vendor":
        return `Match to Vendor`;
      case "categorize":
        return `Categorize`;
      default:
        return action.type;
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings className="size-4" />
            Matching Rules
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Matching Rules</SheetTitle>
          <SheetDescription>
            Create rules to automatically match transactions with customers, vendors, or categories.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Create New Rule Button */}
          {!isCreating && (
            <Button onClick={() => setIsCreating(true)} className="w-full">
              <Plus className="size-4" />
              Create New Rule
            </Button>
          )}

          {/* Create Rule Form */}
          {isCreating && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">New Matching Rule</CardTitle>
                <CardDescription>Define conditions and actions for automatic matching</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Rule Name */}
                <div className="space-y-2">
                  <Label>Rule Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Match Grab payments"
                  />
                </div>

                {/* Conditions */}
                <div className="space-y-3">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Conditions</Label>

                  <div className="space-y-2">
                    <Label>Description Contains (comma separated)</Label>
                    <Input
                      value={formData.descriptionContains}
                      onChange={(e) => setFormData({ ...formData, descriptionContains: e.target.value })}
                      placeholder="e.g., grab, grabpay"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Min Amount (MYR)</Label>
                      <Input
                        type="number"
                        value={formData.amountMin}
                        onChange={(e) => setFormData({ ...formData, amountMin: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Amount (MYR)</Label>
                      <Input
                        type="number"
                        value={formData.amountMax}
                        onChange={(e) => setFormData({ ...formData, amountMax: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Transaction Type</Label>
                    <Select
                      value={formData.transactionType}
                      onValueChange={(value) => setFormData({ ...formData, transactionType: value as "deposit" | "withdrawal" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit (Income)</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal (Expense)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Action */}
                <div className="space-y-3">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Action</Label>

                  <div className="space-y-2">
                    <Label>Action Type *</Label>
                    <Select
                      value={formData.actionType}
                      onValueChange={(value) => setFormData({
                        ...formData,
                        actionType: value as "match_customer" | "match_vendor" | "categorize",
                        customerId: "",
                        vendorId: "",
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="match_customer">Match to Customer</SelectItem>
                        <SelectItem value="match_vendor">Match to Vendor</SelectItem>
                        <SelectItem value="categorize">Categorize</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.actionType === "match_customer" && (
                    <div className="space-y-2">
                      <Label>Customer</Label>
                      <Select
                        value={formData.customerId}
                        onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers?.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.actionType === "match_vendor" && (
                    <div className="space-y-2">
                      <Label>Vendor</Label>
                      <Select
                        value={formData.vendorId}
                        onValueChange={(value) => setFormData({ ...formData, vendorId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors?.map((vendor) => (
                            <SelectItem key={vendor.id} value={vendor.id}>
                              {vendor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* Form Actions */}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={resetForm} className="flex-1">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={createRuleMutation.isPending}
                    className="flex-1"
                  >
                    {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Rules */}
          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs uppercase tracking-wide">
              Existing Rules ({rules?.length ?? 0})
            </Label>

            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-8">Loading rules...</div>
            ) : rules?.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg bg-muted/30">
                No matching rules yet. Create one to start auto-matching transactions.
              </div>
            ) : (
              <div className="space-y-2">
                {rules?.map((rule) => {
                  const conditions = rule.conditions as MatchingRule["conditions"];
                  const action = rule.action as MatchingRule["action"];

                  return (
                    <Card key={rule.id}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getActionIcon(action.type)}
                              <span className="font-medium text-sm">{rule.name}</span>
                            </div>

                            {/* Conditions */}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {conditions.descriptionContains?.length ? (
                                <Badge variant="outline" className="text-xs">
                                  Contains: {conditions.descriptionContains.join(", ")}
                                </Badge>
                              ) : null}
                              {conditions.amountMin !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  Min: RM{conditions.amountMin}
                                </Badge>
                              )}
                              {conditions.amountMax !== undefined && (
                                <Badge variant="outline" className="text-xs">
                                  Max: RM{conditions.amountMax}
                                </Badge>
                              )}
                              {conditions.transactionType && (
                                <Badge variant="outline" className="text-xs">
                                  Type: {conditions.transactionType}
                                </Badge>
                              )}
                            </div>

                            {/* Action */}
                            <div className="text-xs text-muted-foreground mt-2">
                              Action: {getActionLabel(action)}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(rule.id)}
                            disabled={deleteRuleMutation.isPending}
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
