import { memo, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users } from "@/components/ui/icons";
import { cn, formatCurrency, getInitials } from "@/lib/utils";

interface TopCustomer {
  name: string;
  email: string | null;
  revenue: number;
  invoiceCount: number;
}

interface TopCustomersProps {
  customers: TopCustomer[];
  currency?: string;
  isLoading?: boolean;
  className?: string;
}

const getAvatarColor = (name: string) => {
  // Use design system semantic colors for consistent theming
  const colors = [
    "bg-primary",
    "bg-info",
    "bg-success",
    "bg-warning",
    "bg-destructive",
    "bg-primary/80",
    "bg-info/80",
  ];
  const index = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[index % colors.length];
};

export const TopCustomers = memo(function TopCustomers({
  customers,
  currency = "MYR",
  isLoading = false,
  className,
}: TopCustomersProps) {
  const maxRevenue = useMemo(
    () => (customers.length > 0 ? Math.max(...customers.map((c) => c.revenue)) : 0),
    [customers]
  );

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-medium">Top Customers</CardTitle>
          <CardDescription>By revenue</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/customers" className="flex items-center gap-1">
            View all
            <ArrowRight className="size-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="mb-2 size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No customers yet</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link to="/customers">Add your first customer</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {customers.map((customer, index) => {
              const percentage = (customer.revenue / maxRevenue) * 100;
              return (
                <div key={`${customer.name}-${index}`} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback className={cn("text-white", getAvatarColor(customer.name))}>
                        {getInitials(customer.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.invoiceCount} invoice{customer.invoiceCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(customer.revenue, currency)}
                    </p>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
