import { useParams, Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  BuildingIcon,
  UsersIcon,
  CreditCardIcon,
  CalendarIcon,
  UserIcon,
  ExternalLinkIcon,
} from "@/components/ui/icons";
import { useAdminOrganization } from "@/api/admin";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
 * Role Badge Component
 */
function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    owner: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Owner" },
    admin: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Admin" },
    member: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Member" },
    viewer: { className: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Viewer" },
  };

  const variant = variants[role] ?? variants.member!;

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

/**
 * Organization Detail Page
 */
export default function SuperadminOrganizationDetail() {
  const { id } = useParams<{ id: string }>();

  // Fetch organization
  const { data: org, isLoading } = useAdminOrganization(id ?? "");

  if (isLoading) {
    return (
      <PageContainer>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!org) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-16">
          <BuildingIcon className="size-16 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Organization not found</h2>
          <p className="text-muted-foreground">The organization you're looking for doesn't exist.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to="/superadmin/organizations">
              <ArrowLeftIcon className="mr-2 size-4" />
              Back to Organizations
            </Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" size="sm" asChild>
          <Link to="/superadmin/organizations">
            <ArrowLeftIcon className="mr-2 size-4" />
            Back to Organizations
          </Link>
        </Button>

        {/* Organization Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-lg bg-muted">
              {org.logoUrl ? (
                <img
                  src={org.logoUrl}
                  alt={org.name}
                  className="size-16 rounded-lg object-cover"
                />
              ) : (
                <BuildingIcon className="size-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{org.name}</h1>
              <p className="text-muted-foreground">/{org.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SubscriptionBadge status={org.subscriptionStatus || "trialing"} />
            <TierBadge tier={org.subscriptionPlan || "free"} />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Organization Details */}
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Organization ID</p>
                    <p className="font-mono text-sm">{org.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Slug</p>
                    <p className="text-sm">/{org.slug}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="text-sm">{org.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="text-sm">{new Date(org.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCardIcon className="size-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <SubscriptionBadge status={org.subscriptionStatus || "trialing"} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tier</p>
                    <TierBadge tier={org.subscriptionPlan || "free"} />
                  </div>
                  {org.stripeCustomerId && (
                    <div>
                      <p className="text-sm text-muted-foreground">Stripe Customer</p>
                      <p className="font-mono text-sm">{org.stripeCustomerId}</p>
                    </div>
                  )}
                  {org.stripeSubscriptionId && (
                    <div>
                      <p className="text-sm text-muted-foreground">Stripe Subscription</p>
                      <p className="font-mono text-sm">{org.stripeSubscriptionId}</p>
                    </div>
                  )}
                </div>
                {org.stripeCustomerId && (
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://dashboard.stripe.com/customers/${org.stripeCustomerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLinkIcon className="mr-2 size-4" />
                      View in Stripe
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Members */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="size-5" />
                  Members
                </CardTitle>
                <CardDescription>
                  {org.members?.length ?? 0} members in this organization
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Organization Role</TableHead>
                      <TableHead>Platform Role</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {org.members?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                          No members
                        </TableCell>
                      </TableRow>
                    ) : (
                      org.members?.map((member: { id: string; role: string; user: { id: string; email: string; name: string | null; avatarUrl: string | null; role: string } }) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                                {member.user.avatarUrl ? (
                                  <img
                                    src={member.user.avatarUrl}
                                    alt={member.user.name || ""}
                                    className="size-8 rounded-full"
                                  />
                                ) : (
                                  <UserIcon className="size-4 text-muted-foreground" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{member.user.name || "No name"}</p>
                                <p className="text-sm text-muted-foreground">{member.user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <RoleBadge role={member.role} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {member.user.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/superadmin/users/${member.user.id}`}>View</Link>
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

          {/* Right Column - Quick Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <SubscriptionBadge status={org.subscriptionStatus || "trialing"} />
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tier</span>
                  <TierBadge tier={org.subscriptionPlan || "free"} />
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Members</span>
                  <span>{org.members?.length ?? 0}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(org.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" disabled>
                  <CreditCardIcon className="mr-2 size-4" />
                  Manage Subscription
                </Button>
                <Button variant="outline" className="w-full justify-start" disabled>
                  <UsersIcon className="mr-2 size-4" />
                  Invite Member
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
