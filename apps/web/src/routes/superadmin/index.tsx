import { UsersIcon, BuildingIcon, FileTextIcon, TrendingUpIcon, AlertCircleIcon } from "@/components/ui/icons";
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
 * Superadmin Dashboard Page
 */
export default function SuperadminDashboard() {
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: growth, isLoading: growthLoading } = useUserGrowth(30);

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your platform's health and activity
          </p>
        </div>

        {/* Stats Grid */}
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

        {/* User Role Distribution */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Users by Role</CardTitle>
              <CardDescription>Distribution of user roles across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : stats?.users.byRole ? (
                <div className="space-y-3">
                  {Object.entries(stats.users.byRole).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`size-2 rounded-full ${
                            role === "superadmin"
                              ? "bg-purple-500"
                              : role === "admin"
                                ? "bg-blue-500"
                                : role === "user"
                                  ? "bg-green-500"
                                  : "bg-gray-500"
                          }`}
                        />
                        <span className="text-sm capitalize">{role}</span>
                      </div>
                      <span className="text-sm font-medium">{String(count)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suspended Users</CardTitle>
              <CardDescription>Users currently suspended from the platform</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex items-center gap-4">
                  {stats?.users.suspended && stats.users.suspended > 0 ? (
                    <>
                      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertCircleIcon className="size-6 text-destructive" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stats.users.suspended}</p>
                        <p className="text-sm text-muted-foreground">
                          suspended accounts
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="size-2 rounded-full bg-green-500" />
                      <span className="text-sm">No suspended users</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent User Growth */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth (Last 30 Days)</CardTitle>
            <CardDescription>New user signups over the past month</CardDescription>
          </CardHeader>
          <CardContent>
            {growthLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : growth && growth.length > 0 ? (
              <div className="flex h-32 items-end gap-1">
                {growth.map((day: { date: string; count: number }, index: number) => {
                  const maxCount = Math.max(...growth.map((d: { count: number }) => d.count));
                  const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                  return (
                    <div
                      key={index}
                      className="group relative flex-1"
                      title={`${day.date}: ${day.count} users`}
                    >
                      <div
                        className="w-full rounded-t bg-primary transition-colors group-hover:bg-primary/80"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center text-muted-foreground">
                <TrendingUpIcon className="mr-2 size-4" />
                No signups in the last 30 days
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
