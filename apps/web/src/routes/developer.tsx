/**
 * Developer Portal Page
 * API Keys and Webhooks management for developers
 */

import { useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  useTestWebhook,
  useWebhookEvents,
  type ApiKey,
  type Webhook,
} from "@/api";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Code2, Key, Webhook as WebhookIcon, Plus, Copy, Trash2, Eye, CheckCircle, Loader2, ExternalLink } from "@/components/ui/icons";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// API Key Card Component
function ApiKeyCard({ apiKey, onRevoke }: { apiKey: ApiKey; onRevoke: (id: string) => void }) {
  const [showKey, setShowKey] = useState(false);

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey.keyPrefix);
    toast.success("Key prefix copied to clipboard");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-medium">{apiKey.name}</CardTitle>
            <CardDescription className="mt-1">
              Created {formatDistanceToNow(new Date(apiKey.createdAt), { addSuffix: true })}
            </CardDescription>
          </div>
          <Badge variant={apiKey.isActive ? "default" : "secondary"}>
            {apiKey.isActive ? "Active" : "Revoked"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
            {showKey ? apiKey.keyPrefix + "..." : "ob_live_••••••••••••"}
          </code>
          <Button variant="ghost" size="icon" onClick={() => setShowKey(!showKey)}>
            <Eye className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={copyKey}>
            <Copy className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Last used:{" "}
            {apiKey.lastUsedAt
              ? formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })
              : "Never"}
          </span>
          <span>Rate limit: {apiKey.rateLimit}/hour</span>
        </div>

        {apiKey.permissions && apiKey.permissions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {apiKey.permissions.slice(0, 5).map((perm) => (
              <Badge key={perm} variant="outline" className="text-xs">
                {perm}
              </Badge>
            ))}
            {apiKey.permissions.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{apiKey.permissions.length - 5} more
              </Badge>
            )}
          </div>
        )}

        {apiKey.isActive && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="w-full">
                <Trash2 className="mr-2 size-4" />
                Revoke Key
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately invalidate this API key. Any applications using this key will
                  stop working. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onRevoke(apiKey.id)}>Revoke</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
}

// Webhook Card Component
function WebhookCard({
  webhook,
  onDelete,
  onTest,
  isTesting,
}: {
  webhook: Webhook;
  onDelete: (id: string) => void;
  onTest: (id: string) => void;
  isTesting: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-medium truncate">{webhook.url}</CardTitle>
            <CardDescription className="mt-1">
              {webhook.description || "No description"}
            </CardDescription>
          </div>
          <Badge variant={webhook.isActive ? "default" : "secondary"}>
            {webhook.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {webhook.events.slice(0, 4).map((event) => (
            <Badge key={event} variant="outline" className="text-xs">
              {event}
            </Badge>
          ))}
          {webhook.events.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{webhook.events.length - 4} more
            </Badge>
          )}
        </div>

        {webhook.stats && (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded bg-muted p-2">
              <div className="font-medium">{webhook.stats.totalDeliveries}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="rounded bg-green-500/10 p-2">
              <div className="font-medium text-green-600">{webhook.stats.successCount}</div>
              <div className="text-xs text-muted-foreground">Success</div>
            </div>
            <div className="rounded bg-red-500/10 p-2">
              <div className="font-medium text-red-600">{webhook.stats.failedCount}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onTest(webhook.id)}
            disabled={!webhook.isActive || isTesting}
          >
            {isTesting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 size-4" />
            )}
            Test
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="flex-1">
                <Trash2 className="mr-2 size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this webhook endpoint. You will no longer receive
                  events at this URL.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(webhook.id)}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

// Create API Key Dialog
function CreateApiKeyDialog({ onSuccess }: { onSuccess: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createMutation = useCreateApiKey();

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const result = await createMutation.mutateAsync({ name: name.trim() });
      onSuccess(result.key);
      setName("");
      setOpen(false);
      toast.success("API key created successfully");
    } catch {
      toast.error("Failed to create API key");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Create API Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key to authenticate your applications with the Open Bookkeeping API.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Key Name</Label>
            <Input
              id="name"
              placeholder="e.g., Production Server, Mobile App"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Create Webhook Dialog
function CreateWebhookDialog() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const { data: eventsData } = useWebhookEvents();
  const createMutation = useCreateWebhook();

  const handleCreate = async () => {
    if (!url.trim() || selectedEvents.length === 0) return;
    try {
      const result = await createMutation.mutateAsync({
        url: url.trim(),
        events: selectedEvents,
        description: description.trim() || undefined,
      });
      toast.success(
        <div>
          <p>Webhook created successfully!</p>
          <p className="mt-1 text-xs font-mono">Secret: {result.secret.substring(0, 16)}...</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Copy the secret now - it won't be shown again!
          </p>
        </div>,
        { duration: 10000 }
      );
      setUrl("");
      setDescription("");
      setSelectedEvents([]);
      setOpen(false);
    } catch {
      toast.error("Failed to create webhook");
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const toggleCategory = (events: string[]) => {
    const allSelected = events.every((e) => selectedEvents.includes(e));
    if (allSelected) {
      setSelectedEvents((prev) => prev.filter((e) => !events.includes(e)));
    } else {
      setSelectedEvents((prev) => [...new Set([...prev, ...events])]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Webhook Endpoint</DialogTitle>
          <DialogDescription>
            Configure a webhook endpoint to receive real-time events from Open Bookkeeping.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="url">Endpoint URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://your-server.com/webhooks"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="e.g., Production webhook for order processing"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Events to Subscribe</Label>
            <div className="rounded-md border p-4 space-y-4 max-h-64 overflow-y-auto">
              {eventsData?.grouped &&
                Object.entries(eventsData.grouped).map(([category, events]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`cat-${category}`}
                        checked={events.every((e) => selectedEvents.includes(e))}
                        onCheckedChange={() => toggleCategory(events)}
                      />
                      <Label htmlFor={`cat-${category}`} className="font-medium capitalize">
                        {category}
                      </Label>
                    </div>
                    <div className="ml-6 grid grid-cols-2 gap-2">
                      {events.map((event) => (
                        <div key={event} className="flex items-center gap-2">
                          <Checkbox
                            id={event}
                            checked={selectedEvents.includes(event)}
                            onCheckedChange={() => toggleEvent(event)}
                          />
                          <Label htmlFor={event} className="text-sm font-normal">
                            {event.split(".")[1]}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedEvents.length} event{selectedEvents.length !== 1 && "s"} selected
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!url.trim() || selectedEvents.length === 0 || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// New Key Display Dialog
function NewKeyDialog({ apiKey, onClose }: { apiKey: string | null; onClose: () => void }) {
  const copyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      toast.success("API key copied to clipboard");
    }
  };

  return (
    <Dialog open={!!apiKey} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="size-5 text-green-500" />
            API Key Created
          </DialogTitle>
          <DialogDescription>
            Your new API key has been created. Copy it now - you won't be able to see it again!
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm break-all">
              {apiKey}
            </code>
            <Button variant="outline" size="icon" onClick={copyKey}>
              <Copy className="size-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Developer Portal Component
export function Developer() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  const { data: apiKeys, isLoading: apiKeysLoading } = useApiKeys({ enabled: !!user });
  const { data: webhooks, isLoading: webhooksLoading } = useWebhooks({ enabled: !!user });

  const revokeMutation = useRevokeApiKey();
  const deleteWebhookMutation = useDeleteWebhook();
  const testWebhookMutation = useTestWebhook();

  const handleRevokeKey = async (id: string) => {
    try {
      await revokeMutation.mutateAsync(id);
      toast.success("API key revoked");
    } catch {
      toast.error("Failed to revoke API key");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await deleteWebhookMutation.mutateAsync(id);
      toast.success("Webhook deleted");
    } catch {
      toast.error("Failed to delete webhook");
    }
  };

  const handleTestWebhook = async (id: string) => {
    setTestingWebhookId(id);
    try {
      const result = await testWebhookMutation.mutateAsync(id);
      if (result.success) {
        toast.success(`Test webhook delivered (${result.responseTimeMs}ms)`);
      } else {
        toast.error(`Test failed: ${result.error}`);
      }
    } catch {
      toast.error("Failed to send test webhook");
    } finally {
      setTestingWebhookId(null);
    }
  };

  const showSkeleton = isAuthLoading || apiKeysLoading || webhooksLoading;

  return (
    <PageContainer>
      <PageHeader
        icon={Code2}
        title="Developer Portal"
        description="Manage API keys and webhooks for integrating with Open Bookkeeping"
      />

      <Tabs defaultValue="api-keys" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex">
          <TabsTrigger value="api-keys" className="gap-2">
            <Key className="size-4" />
            <span>API Keys</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <WebhookIcon className="size-4" />
            <span>Webhooks</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-6">
          {/* API Documentation Link */}
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <h3 className="font-medium">API Documentation</h3>
                <p className="text-sm text-muted-foreground">
                  Learn how to authenticate and use the Open Bookkeeping API
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="/api/docs" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 size-4" />
                  View Docs
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Create Key + List */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your API Keys</h2>
            <CreateApiKeyDialog onSuccess={setNewApiKey} />
          </div>

          {showSkeleton ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {apiKeys.map((key) => (
                <ApiKeyCard key={key.id} apiKey={key} onRevoke={handleRevokeKey} />
              ))}
            </div>
          ) : (
            <Card className="py-12">
              <CardContent className="text-center">
                <Key className="mx-auto size-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No API Keys</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create an API key to start integrating with Open Bookkeeping
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-6">
          {/* Webhook Info */}
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium">Webhook Security</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                All webhook payloads are signed with HMAC-SHA256. Verify the{" "}
                <code className="rounded bg-muted px-1 text-xs">X-Webhook-Signature</code> header to
                ensure authenticity.
              </p>
            </CardContent>
          </Card>

          {/* Create Webhook + List */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Webhooks</h2>
            <CreateWebhookDialog />
          </div>

          {showSkeleton ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : webhooks && webhooks.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {webhooks.map((webhook) => (
                <WebhookCard
                  key={webhook.id}
                  webhook={webhook}
                  onDelete={handleDeleteWebhook}
                  onTest={handleTestWebhook}
                  isTesting={testingWebhookId === webhook.id}
                />
              ))}
            </div>
          ) : (
            <Card className="py-12">
              <CardContent className="text-center">
                <WebhookIcon className="mx-auto size-12 text-muted-foreground/50" />
                <h3 className="mt-4 font-medium">No Webhooks</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a webhook endpoint to receive real-time event notifications
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* New Key Display Dialog */}
      <NewKeyDialog apiKey={newApiKey} onClose={() => setNewApiKey(null)} />
    </PageContainer>
  );
}
