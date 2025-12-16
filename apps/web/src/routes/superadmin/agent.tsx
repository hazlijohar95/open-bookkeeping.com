import {
  SparklesIcon,
  ActivityIcon,
  ZapIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  MessageSquareIcon,
} from "@/components/ui/icons";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Stats Card Component - Shows empty/zero state
 */
function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  iconColor = "text-muted-foreground",
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`size-4 ${iconColor}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-muted-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * AI Co-Worker Oversight Page
 *
 * Shows agent usage statistics and safety metrics.
 * Currently displays "no data" state as agent tracking is not yet implemented.
 */
export default function SuperadminAgent() {
  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Co-Worker Oversight</h1>
          <p className="text-muted-foreground">
            Monitor AI Co-Worker usage and actions across the platform
          </p>
        </div>

        {/* Overview Stats - All Zero */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Sessions"
            value={0}
            description="No agent sessions"
            icon={MessageSquareIcon}
            iconColor="text-muted-foreground"
          />
          <StatsCard
            title="Total Tokens"
            value="0"
            description="No token usage"
            icon={ZapIcon}
            iconColor="text-muted-foreground"
          />
          <StatsCard
            title="Total Actions"
            value={0}
            description="No actions recorded"
            icon={ActivityIcon}
            iconColor="text-muted-foreground"
          />
          <StatsCard
            title="Approval Rate"
            value="--"
            description="No approvals yet"
            icon={CheckCircleIcon}
            iconColor="text-muted-foreground"
          />
        </div>

        {/* Main Content - Empty States */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Action Breakdown - Empty */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon className="size-5" />
                Actions by Type
              </CardTitle>
              <CardDescription>Breakdown of AI agent actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <ActivityIcon className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No actions recorded</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Agent actions will appear here
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Safety & Approvals - Empty */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangleIcon className="size-5" />
                Safety Controls
              </CardTitle>
              <CardDescription>Approval workflow and safety metrics</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Pending Approvals</span>
                  <Badge variant="outline">0</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  No actions waiting for approval
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Approval Rate</span>
                  <span className="text-sm text-muted-foreground">--</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  No approval data available
                </p>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
                <div className="flex items-center gap-2">
                  <CheckCircleIcon className="size-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    Safety Status
                  </span>
                </div>
                <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                  0 incidents recorded
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity - Empty */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="size-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest AI agent actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <SparklesIcon className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No recent activity</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agent interactions will appear here
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Notice */}
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
          <CardContent className="py-6">
            <div className="flex flex-col items-center text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <SparklesIcon className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-blue-900 dark:text-blue-100">
                AI Co-Worker Analytics
              </h3>
              <p className="mt-2 max-w-md text-sm text-blue-800 dark:text-blue-200">
                This dashboard will show AI Co-Worker usage statistics once users start
                interacting with the AI Co-Worker feature. Metrics include session counts,
                token usage, action types, and approval workflows.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
