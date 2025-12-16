import {
  DollarSignIcon,
  CreditCardIcon,
  CalendarIcon,
  ArrowUpRightIcon,
  AlertTriangleIcon,
  ExternalLinkIcon,
} from "@/components/ui/icons";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  value: string;
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
 * Revenue Page - Shows Stripe not configured state
 *
 * This page requires Stripe integration to display real revenue data.
 * Currently shows a "not configured" state with instructions.
 */
export default function SuperadminRevenue() {
  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
          <p className="text-muted-foreground">
            Track platform revenue and billing metrics
          </p>
        </div>

        {/* Overview Stats - All Zero */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Monthly Recurring Revenue"
            value="RM 0"
            description="No billing data"
            icon={DollarSignIcon}
            iconColor="text-muted-foreground"
          />
          <StatsCard
            title="Annual Recurring Revenue"
            value="RM 0"
            description="Projected based on MRR"
            icon={CalendarIcon}
            iconColor="text-muted-foreground"
          />
          <StatsCard
            title="Avg. Revenue per Org"
            value="RM 0"
            description="No paying organizations"
            icon={ArrowUpRightIcon}
            iconColor="text-muted-foreground"
          />
          <StatsCard
            title="Failed Payments"
            value="0"
            description="No payment data"
            icon={AlertTriangleIcon}
            iconColor="text-muted-foreground"
          />
        </div>

        {/* Main Content - Empty State */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Revenue Chart - Empty */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue</CardTitle>
              <CardDescription>Revenue trend over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <DollarSignIcon className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No revenue data</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Plan - Empty */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Plan</CardTitle>
              <CardDescription>Breakdown of MRR by subscription tier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed">
                <div className="text-center">
                  <CreditCardIcon className="mx-auto size-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">No subscription data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Payments - Empty */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="size-5" />
              Recent Payments
            </CardTitle>
            <CardDescription>Latest payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
              <div className="text-center">
                <CreditCardIcon className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">No payment transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe Integration Notice */}
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900">
                <CreditCardIcon className="size-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-amber-900 dark:text-amber-100">
                Stripe Integration Required
              </h3>
              <p className="mt-2 max-w-md text-sm text-amber-800 dark:text-amber-200">
                To display real revenue data, payment analytics, and subscription metrics,
                you need to configure Stripe integration. This enables billing, subscriptions,
                and payment tracking.
              </p>
              <div className="mt-4 flex gap-3">
                <Button variant="outline" size="sm" className="gap-2" disabled>
                  <ExternalLinkIcon className="size-4" />
                  Connect Stripe
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <a
                    href="https://stripe.com/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Docs
                  </a>
                </Button>
              </div>
              <p className="mt-4 text-xs text-amber-700 dark:text-amber-300">
                Required environment variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
