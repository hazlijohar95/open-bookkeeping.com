import { useState } from "react";
import {
  SettingsIcon,
  ShieldIcon,
  BellIcon,
  ToggleLeftIcon,
  SaveIcon,
  PlusIcon,
} from "@/components/ui/icons";
import {
  useSystemSettings,
  useUpdateSystemSettings,
  useFeatureFlags,
  useToggleFeatureFlag,
  useCreateFeatureFlag,
} from "@/api/admin";
import { PageContainer } from "@/components/ui/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

/**
 * Feature Flag Item Component
 */
function FeatureFlagItem({
  flag,
  onToggle,
  isToggling,
}: {
  flag: { key: string; name: string; description?: string | null; isEnabled: boolean };
  onToggle: (key: string, enabled: boolean) => void;
  isToggling: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="space-y-1">
        <p className="font-medium">{flag.name}</p>
        <p className="text-sm text-muted-foreground">{flag.description || flag.key}</p>
      </div>
      <Switch
        checked={flag.isEnabled}
        onCheckedChange={(checked) => onToggle(flag.key, checked)}
        disabled={isToggling}
      />
    </div>
  );
}

/**
 * System Settings Page
 */
export default function SuperadminSettings() {
  // Fetch settings and feature flags
  const { data: settings, isLoading: settingsLoading } = useSystemSettings();
  const { data: featureFlags, isLoading: flagsLoading } = useFeatureFlags();

  // Mutations
  const updateSettingsMutation = useUpdateSystemSettings();
  const toggleFlagMutation = useToggleFeatureFlag();
  const createFlagMutation = useCreateFeatureFlag();

  // Local state for settings form
  const [localSettings, setLocalSettings] = useState({
    maintenanceMode: false,
    maintenanceMessage: "",
    announcementMessage: "",
    announcementEnabled: false,
    trialDurationDays: 14,
    sessionTimeoutMinutes: 60,
    defaultDailyInvoiceLimit: 50,
  });

  // New feature flag dialog state
  const [newFlagDialog, setNewFlagDialog] = useState(false);
  const [newFlag, setNewFlag] = useState({
    key: "",
    name: "",
    description: "",
  });

  // Update local settings when data loads
  useState(() => {
    if (settings) {
      setLocalSettings({
        maintenanceMode: settings.maintenanceMode ?? false,
        maintenanceMessage: settings.maintenanceMessage ?? "",
        announcementMessage: settings.announcementMessage ?? "",
        announcementEnabled: settings.announcementEnabled ?? false,
        trialDurationDays: settings.trialDurationDays ?? 14,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes ?? 60,
        defaultDailyInvoiceLimit: settings.defaultDailyInvoiceLimit ?? 50,
      });
    }
  });

  const handleSaveSettings = async () => {
    try {
      await updateSettingsMutation.mutateAsync(localSettings);
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    }
  };

  const handleToggleFlag = async (key: string, enabled: boolean) => {
    try {
      await toggleFlagMutation.mutateAsync({ key, enabled });
      toast.success(`Feature flag ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to toggle feature flag");
    }
  };

  const handleCreateFlag = async () => {
    if (!newFlag.key || !newFlag.name) return;

    try {
      await createFlagMutation.mutateAsync({
        key: newFlag.key,
        name: newFlag.name,
        description: newFlag.description || undefined,
      });
      toast.success("Feature flag created");
      setNewFlagDialog(false);
      setNewFlag({ key: "", name: "", description: "" });
    } catch {
      toast.error("Failed to create feature flag");
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">
            Configure platform-wide settings and feature flags
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="gap-2">
              <SettingsIcon className="size-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <ShieldIcon className="size-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <BellIcon className="size-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <ToggleLeftIcon className="size-4" />
              Features
            </TabsTrigger>
          </TabsList>

          {/* General Settings */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic platform configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {settingsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Default Trial Days</Label>
                      <Input
                        type="number"
                        value={localSettings.trialDurationDays}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            trialDurationDays: parseInt(e.target.value) || 14,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of days for new organization free trials
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Default Daily Invoice Limit</Label>
                      <Input
                        type="number"
                        value={localSettings.defaultDailyInvoiceLimit}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            defaultDailyInvoiceLimit: parseInt(e.target.value) || 50,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Default daily invoice limit for new users
                      </p>
                    </div>

                    <Separator />

                    <Button
                      onClick={handleSaveSettings}
                      disabled={updateSettingsMutation.isPending}
                    >
                      <SaveIcon className="mr-2 size-4" />
                      {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Maintenance Mode */}
            <Card className="border-amber-200 dark:border-amber-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldIcon className="size-5 text-amber-500" />
                  Maintenance Mode
                </CardTitle>
                <CardDescription>
                  Enable maintenance mode to prevent user access during updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Maintenance Mode</p>
                    <p className="text-sm text-muted-foreground">
                      Users will see a maintenance page instead of the app
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.maintenanceMode}
                    onCheckedChange={(checked) =>
                      setLocalSettings({ ...localSettings, maintenanceMode: checked })
                    }
                  />
                </div>

                {localSettings.maintenanceMode && (
                  <div className="space-y-2">
                    <Label>Maintenance Message</Label>
                    <Textarea
                      placeholder="We're currently performing scheduled maintenance..."
                      value={localSettings.maintenanceMessage}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          maintenanceMessage: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                  variant={localSettings.maintenanceMode ? "destructive" : "default"}
                >
                  <SaveIcon className="mr-2 size-4" />
                  {localSettings.maintenanceMode ? "Enable Maintenance" : "Save"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Configure security and session settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Session Timeout (minutes)</Label>
                  <Input
                    type="number"
                    value={localSettings.sessionTimeoutMinutes}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        sessionTimeoutMinutes: parseInt(e.target.value) || 60,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    How long until inactive users are logged out
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Require 2FA for Admins</p>
                      <p className="text-sm text-muted-foreground">
                        Force two-factor authentication for admin users
                      </p>
                    </div>
                    <Switch disabled />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">IP Whitelist</p>
                      <p className="text-sm text-muted-foreground">
                        Restrict admin access to specific IP addresses
                      </p>
                    </div>
                    <Switch disabled />
                  </div>
                </div>

                <Separator />

                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                >
                  <SaveIcon className="mr-2 size-4" />
                  Save Security Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Announcement Banner</CardTitle>
                <CardDescription>
                  Display a banner message to all users across the platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Banner</p>
                    <p className="text-sm text-muted-foreground">
                      Show announcement banner to all users
                    </p>
                  </div>
                  <Switch
                    checked={localSettings.announcementEnabled}
                    onCheckedChange={(checked) =>
                      setLocalSettings({ ...localSettings, announcementEnabled: checked })
                    }
                  />
                </div>

                {localSettings.announcementEnabled && (
                  <div className="space-y-2">
                    <Label>Banner Message</Label>
                    <Textarea
                      placeholder="New feature available! Check out..."
                      value={localSettings.announcementMessage}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          announcementMessage: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                <Button
                  onClick={handleSaveSettings}
                  disabled={updateSettingsMutation.isPending}
                >
                  <SaveIcon className="mr-2 size-4" />
                  Save Notification Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Feature Flags */}
          <TabsContent value="features" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Feature Flags</CardTitle>
                  <CardDescription>
                    Toggle features on or off across the platform
                  </CardDescription>
                </div>
                <Dialog open={newFlagDialog} onOpenChange={setNewFlagDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <PlusIcon className="mr-2 size-4" />
                      Add Flag
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Feature Flag</DialogTitle>
                      <DialogDescription>
                        Add a new feature flag to control feature availability
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Key</Label>
                        <Input
                          placeholder="new_feature_enabled"
                          value={newFlag.key}
                          onChange={(e) => setNewFlag({ ...newFlag, key: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Unique identifier (snake_case recommended)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          placeholder="New Feature"
                          value={newFlag.name}
                          onChange={(e) => setNewFlag({ ...newFlag, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Description of this feature flag..."
                          value={newFlag.description}
                          onChange={(e) =>
                            setNewFlag({ ...newFlag, description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewFlagDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateFlag}
                        disabled={!newFlag.key || !newFlag.name || createFlagMutation.isPending}
                      >
                        {createFlagMutation.isPending ? "Creating..." : "Create Flag"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {flagsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : featureFlags && featureFlags.length > 0 ? (
                  <div className="space-y-3">
                    {featureFlags.map((flag) => (
                      <FeatureFlagItem
                        key={flag.key}
                        flag={flag}
                        onToggle={handleToggleFlag}
                        isToggling={toggleFlagMutation.isPending}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <ToggleLeftIcon className="mx-auto size-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">No Feature Flags</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Create your first feature flag to control feature availability
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
