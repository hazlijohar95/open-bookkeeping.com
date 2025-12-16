import { useState } from "react";
import { Link } from "react-router-dom";
import {
  SearchIcon,
  MoreHorizontalIcon,
  UserIcon,
  ShieldIcon,
  EyeIcon,
  BanIcon,
  CheckCircleIcon,
} from "@/components/ui/icons";
import {
  useAdminUsers,
  useSuspendUser,
  useUnsuspendUser,
  useUpdateUserRole,
} from "@/api/admin";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type UserRole = "superadmin" | "admin" | "user" | "viewer";

/**
 * Role Badge Component
 */
function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, { className: string; label: string }> = {
    superadmin: {
      className:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      label: "Superadmin",
    },
    admin: {
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      label: "Admin",
    },
    user: {
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      label: "User",
    },
    viewer: {
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      label: "Viewer",
    },
  };

  const variant = variants[role] ?? variants.user!;

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

/**
 * Users Management Page
 */
export default function SuperadminUsers() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [suspendedFilter, setSuspendedFilter] = useState<
    "all" | "active" | "suspended"
  >("all");
  const [page, setPage] = useState(0);
  const limit = 20;

  // Dialog states
  const [suspendDialog, setSuspendDialog] = useState<{
    open: boolean;
    userId?: string;
    email?: string;
  }>({ open: false });
  const [suspendReason, setSuspendReason] = useState("");
  const [roleDialog, setRoleDialog] = useState<{
    open: boolean;
    userId?: string;
    email?: string;
    currentRole?: string;
  }>({ open: false });
  const [newRole, setNewRole] = useState<UserRole>("user");

  // Fetch users
  const { data, isLoading, refetch } = useAdminUsers({
    search: search || undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
    isSuspended:
      suspendedFilter === "all" ? undefined : suspendedFilter === "suspended",
    limit,
    offset: page * limit,
  });

  // Mutations
  const suspendMutation = useSuspendUser();
  const unsuspendMutation = useUnsuspendUser();
  const updateRoleMutation = useUpdateUserRole();

  const handleSuspend = async () => {
    if (!suspendDialog.userId || !suspendReason.trim()) return;

    try {
      await suspendMutation.mutateAsync({
        userId: suspendDialog.userId,
        reason: suspendReason,
      });
      toast.success("User suspended successfully");
      setSuspendDialog({ open: false });
      setSuspendReason("");
      void refetch();
    } catch {
      toast.error("Failed to suspend user");
    }
  };

  const handleUnsuspend = async (userId: string) => {
    try {
      await unsuspendMutation.mutateAsync({ userId });
      toast.success("User unsuspended successfully");
      void refetch();
    } catch {
      toast.error("Failed to unsuspend user");
    }
  };

  const handleRoleChange = async () => {
    if (!roleDialog.userId) return;

    try {
      await updateRoleMutation.mutateAsync({
        userId: roleDialog.userId,
        newRole,
      });
      toast.success("User role updated successfully");
      setRoleDialog({ open: false });
      void refetch();
    } catch {
      toast.error("Failed to update user role");
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage all users on the platform
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by email or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={roleFilter}
                onValueChange={(v) => setRoleFilter(v as UserRole | "all")}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={suspendedFilter}
                onValueChange={(v) =>
                  setSuspendedFilter(v as "all" | "active" | "suspended")
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-10 rounded-full" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="size-8" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : data?.users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.name || ""}
                                className="size-10 rounded-full"
                              />
                            ) : (
                              <UserIcon className="text-muted-foreground size-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {user.name || "No name"}
                            </p>
                            <p className="text-muted-foreground text-sm">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell>
                        {user.isSuspended ? (
                          <Badge variant="destructive">Suspended</Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800"
                          >
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link to={`/superadmin/users/${user.id}`}>
                                <EyeIcon className="mr-2 size-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRoleDialog({
                                  open: true,
                                  userId: user.id,
                                  email: user.email,
                                  currentRole: user.role,
                                });
                                setNewRole(user.role as UserRole);
                              }}
                            >
                              <ShieldIcon className="mr-2 size-4" />
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.isSuspended ? (
                              <DropdownMenuItem
                                onClick={() => handleUnsuspend(user.id)}
                                className="text-green-600"
                              >
                                <CheckCircleIcon className="mr-2 size-4" />
                                Unsuspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() =>
                                  setSuspendDialog({
                                    open: true,
                                    userId: user.id,
                                    email: user.email,
                                  })
                                }
                                className="text-destructive"
                                disabled={user.role === "superadmin"}
                              >
                                <BanIcon className="mr-2 size-4" />
                                Suspend
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>

          {/* Pagination */}
          {data && data.total > limit && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-muted-foreground text-sm">
                Showing {page * limit + 1} to{" "}
                {Math.min((page + 1) * limit, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={(page + 1) * limit >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Suspend Dialog */}
      <Dialog
        open={suspendDialog.open}
        onOpenChange={(open) => setSuspendDialog({ open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              Suspend {suspendDialog.email}. They will be logged out and unable
              to access the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for suspension</Label>
              <Textarea
                id="reason"
                placeholder="Enter the reason for suspending this user..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendDialog({ open: false })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspendMutation.isPending}
            >
              {suspendMutation.isPending ? "Suspending..." : "Suspend User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog
        open={roleDialog.open}
        onOpenChange={(open) => setRoleDialog({ open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the role for {roleDialog.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as UserRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="superadmin">Superadmin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRoleDialog({ open: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={
                updateRoleMutation.isPending ||
                newRole === roleDialog.currentRole
              }
            >
              {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
