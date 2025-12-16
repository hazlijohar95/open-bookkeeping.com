import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCardIcon,
  BuildingIcon,
  UsersIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { useAdminOrganizations } from "@/api/admin";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stats Card Component
 */
function StatsCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Subscription Badge Component
 */
function SubscriptionBadge({ status }: { status: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    trialing: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Trialing" },
    active: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Active" },
    past_due: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Past Due" },
    canceled: { className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Canceled" },
    unpaid: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "Unpaid" },
  };

  const variant = variants[status] ?? variants.active!;

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

/**
 * Tier Badge Component
 */
function TierBadge({ tier }: { tier: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    free: { className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Free" },
    starter: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Starter" },
    professional: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Professional" },
    enterprise: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", label: "Enterprise" },
  };

  const variant = variants[tier] ?? variants.free!;

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

/**
 * Subscriptions Management Page
 */
export default function SuperadminSubscriptions() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Fetch organizations with subscription info
  const { data, isLoading } = useAdminOrganizations({
    search: search || undefined,
    subscriptionStatus: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Filter by tier client-side since we have the data
  const filteredOrgs = data?.organizations.filter((org) => {
    if (tierFilter === "all") return true;
    return org.subscriptionPlan === tierFilter;
  });

  // Placeholder stats - in production, these would come from the API
  const stats = {
    active: data?.organizations.filter((o) => o.subscriptionStatus === "active").length ?? 0,
    trialing: data?.organizations.filter((o) => o.subscriptionStatus === "trialing").length ?? 0,
    pastDue: data?.organizations.filter((o) => o.subscriptionStatus === "past_due").length ?? 0,
    canceled: data?.organizations.filter((o) => o.subscriptionStatus === "canceled").length ?? 0,
  };

  const tierCounts = {
    free: data?.organizations.filter((o) => o.subscriptionPlan === "free").length ?? 0,
    starter: data?.organizations.filter((o) => o.subscriptionPlan === "starter").length ?? 0,
    professional: data?.organizations.filter((o) => o.subscriptionPlan === "professional").length ?? 0,
    enterprise: data?.organizations.filter((o) => o.subscriptionPlan === "enterprise").length ?? 0,
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage organization subscriptions and billing
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Active Subscriptions"
            value={stats.active}
            icon={CreditCardIcon}
          />
          <StatsCard
            title="Trialing"
            value={stats.trialing}
            description="Free trial users"
            icon={UsersIcon}
          />
          <StatsCard
            title="Past Due"
            value={stats.pastDue}
            description="Need attention"
            icon={CreditCardIcon}
          />
          <StatsCard
            title="Canceled"
            value={stats.canceled}
            description="This month"
            icon={CreditCardIcon}
          />
        </div>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Plan Distribution</CardTitle>
            <CardDescription>Subscriptions by plan tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold">{tierCounts.free}</p>
                <p className="text-sm text-muted-foreground">Free</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{tierCounts.starter}</p>
                <p className="text-sm text-muted-foreground">Starter</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-purple-600">{tierCounts.professional}</p>
                <p className="text-sm text-muted-foreground">Professional</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{tierCounts.enterprise}</p>
                <p className="text-sm text-muted-foreground">Enterprise</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search organizations..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="past_due">Past Due</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Subscriptions Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredOrgs?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No subscriptions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrgs?.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                            <BuildingIcon className="size-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{org.name}</p>
                            <p className="text-xs text-muted-foreground">/{org.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <TierBadge tier={org.subscriptionPlan || "free"} />
                      </TableCell>
                      <TableCell>
                        <SubscriptionBadge status={org.subscriptionStatus || "trialing"} />
                      </TableCell>
                      <TableCell>{org.memberCount ?? 0}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/superadmin/organizations/${org.id}`}>
                            Manage
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
