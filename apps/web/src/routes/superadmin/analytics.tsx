import { UsersIcon, FileTextIcon, TrendingUpIcon, BuildingIcon } from "@/components/ui/icons";
import { usePlatformStats, useUserGrowth } from "@/api/admin";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stats Card Component
 */
function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  isLoading,
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  isLoading?: boolean;
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
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <p
                className={`text-xs ${
                  trend.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend.isPositive ? "+" : ""}
                {trend.value}% from last month
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Chart placeholder - in a real app, you'd use a charting library like Recharts
 */
function ChartPlaceholder({
  data,
  isLoading,
  type = "bar",
}: {
  data?: { date: string; count: number }[];
  isLoading?: boolean;
  type?: "bar" | "line";
}) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        <TrendingUpIcon className="mr-2 size-4" />
        No data available
      </div>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <div className="h-64">
      <div className="flex h-full items-end gap-1">
        {data.map((day, index) => {
          const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
          return (
            <div
              key={index}
              className="group relative flex-1"
              title={`${day.date}: ${day.count}`}
            >
              <div
                className={`w-full rounded-t transition-colors ${
                  type === "line"
                    ? "bg-blue-500 group-hover:bg-blue-400"
                    : "bg-primary group-hover:bg-primary/80"
                }`}
                style={{ height: `${Math.max(height, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Analytics Page
 */
export default function SuperadminAnalytics() {
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: growth30, isLoading: growth30Loading } = useUserGrowth(30);
  const { data: growth90, isLoading: growth90Loading } = useUserGrowth(90);

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Platform-wide statistics and insights
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Users"
            value={stats?.users.total ?? 0}
            description={`${stats?.users.active ?? 0} active`}
            icon={UsersIcon}
            isLoading={statsLoading}
          />
          <StatsCard
            title="Organizations"
            value={stats?.organizations.total ?? 0}
            icon={BuildingIcon}
            isLoading={statsLoading}
          />
          <StatsCard
            title="Total Invoices"
            value={stats?.documents.invoices ?? 0}
            icon={FileTextIcon}
            isLoading={statsLoading}
          />
          <StatsCard
            title="Total Bills"
            value={stats?.documents.bills ?? 0}
            icon={FileTextIcon}
            isLoading={statsLoading}
          />
        </div>

        {/* User Growth Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>User Growth (30 Days)</CardTitle>
              <CardDescription>New user signups over the past month</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartPlaceholder
                data={growth30}
                isLoading={growth30Loading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Growth (90 Days)</CardTitle>
              <CardDescription>New user signups over the past quarter</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartPlaceholder
                data={growth90}
                isLoading={growth90Loading}
                type="line"
              />
            </CardContent>
          </Card>
        </div>

        {/* User Distribution */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Users by Role</CardTitle>
              <CardDescription>Distribution of user roles across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-6 w-1/4" />
                </div>
              ) : stats?.users.byRole ? (
                <div className="space-y-4">
                  {Object.entries(stats.users.byRole).map(([role, count]) => {
                    const total = stats.users.total || 1;
                    const percentage = Math.round((Number(count) / total) * 100);
                    const colors: Record<string, string> = {
                      superadmin: "bg-purple-500",
                      admin: "bg-blue-500",
                      user: "bg-green-500",
                      viewer: "bg-gray-500",
                    };
                    return (
                      <div key={role} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="capitalize">{role}</span>
                          <span className="font-medium">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full ${colors[role] || "bg-primary"}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Platform Health</CardTitle>
              <CardDescription>Key platform metrics and status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">Active Users</span>
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-5 w-12" />
                  ) : (
                    <span className="font-medium">{stats?.users.active ?? 0}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="size-4 text-red-500" />
                    <span className="text-sm">Suspended Users</span>
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-5 w-12" />
                  ) : (
                    <span className="font-medium text-red-600">{stats?.users.suspended ?? 0}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">Total Documents</span>
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-5 w-12" />
                  ) : (
                    <span className="font-medium">
                      {(stats?.documents.invoices ?? 0) + (stats?.documents.bills ?? 0)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BuildingIcon className="size-4 text-muted-foreground" />
                    <span className="text-sm">Total Organizations</span>
                  </div>
                  {statsLoading ? (
                    <Skeleton className="h-5 w-12" />
                  ) : (
                    <span className="font-medium">{stats?.organizations.total ?? 0}</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Document Analytics */}
        <Card>
          <CardHeader>
            <CardTitle>Document Overview</CardTitle>
            <CardDescription>Breakdown of documents created on the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <FileTextIcon className="size-5 text-blue-500" />
                  <span className="font-medium">Invoices</span>
                </div>
                {statsLoading ? (
                  <Skeleton className="mt-2 h-8 w-16" />
                ) : (
                  <p className="mt-2 text-3xl font-bold">{stats?.documents.invoices ?? 0}</p>
                )}
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <FileTextIcon className="size-5 text-green-500" />
                  <span className="font-medium">Bills</span>
                </div>
                {statsLoading ? (
                  <Skeleton className="mt-2 h-8 w-16" />
                ) : (
                  <p className="mt-2 text-3xl font-bold">{stats?.documents.bills ?? 0}</p>
                )}
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <UsersIcon className="size-5 text-purple-500" />
                  <span className="font-medium">Organizations</span>
                </div>
                {statsLoading ? (
                  <Skeleton className="mt-2 h-8 w-16" />
                ) : (
                  <p className="mt-2 text-3xl font-bold">{stats?.organizations?.total ?? 0}</p>
                )}
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <BuildingIcon className="size-5 text-amber-500" />
                  <span className="font-medium">Users</span>
                </div>
                {statsLoading ? (
                  <Skeleton className="mt-2 h-8 w-16" />
                ) : (
                  <p className="mt-2 text-3xl font-bold">{stats?.users?.total ?? 0}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
