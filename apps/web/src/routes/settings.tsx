import {
  useSettings,
  useUpdateCompanyProfile,
  useUpdateInvoiceDefaults,
  useUpdateNotificationSettings,
  useUpdateAppearanceSettings,
  useEInvoiceSettings,
  useValidateEInvoiceSettings,
  useUpdateEInvoiceSettings,
} from "@/api";
import {
  CompanyProfileForm,
  InvoiceDefaultsForm,
  NotificationSettingsForm,
  AppearanceSettingsForm,
  EInvoiceSettingsForm,
} from "@/components/settings";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IdBadgeIcon, ReceiptIcon, InboxArrowDownIcon, SlidersIcon, FileCheckIcon } from "@/assets/icons";

export function Settings() {
  const { data: settings, isLoading } = useSettings();

  // E-Invoice queries
  const { data: einvoiceSettings, isLoading: einvoiceLoading } = useEInvoiceSettings();
  const { data: einvoiceValidation } = useValidateEInvoiceSettings();

  const companyProfileMutation = useUpdateCompanyProfile();
  const invoiceDefaultsMutation = useUpdateInvoiceDefaults();
  const notificationsMutation = useUpdateNotificationSettings();
  const appearanceMutation = useUpdateAppearanceSettings();
  const einvoiceMutation = useUpdateEInvoiceSettings();

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Manage your account settings and preferences"
      />

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
          <TabsTrigger value="company" className="gap-2">
            <IdBadgeIcon className="size-4" />
            <span className="hidden sm:inline">Company</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2">
            <ReceiptIcon className="size-4" />
            <span className="hidden sm:inline">Invoices</span>
          </TabsTrigger>
          <TabsTrigger value="einvoice" className="gap-2">
            <FileCheckIcon className="size-4" />
            <span className="hidden sm:inline">E-Invoice</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <InboxArrowDownIcon className="size-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <SlidersIcon className="size-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="space-y-4">
          <CompanyProfileForm
            defaultValues={{
              companyName: settings?.companyName,
              companyAddress: settings?.companyAddress,
              companyTaxId: settings?.companyTaxId,
              companyPhone: settings?.companyPhone,
              companyEmail: settings?.companyEmail,
              companyWebsite: settings?.companyWebsite,
            }}
            onSubmit={async (data) => {
              await companyProfileMutation.mutateAsync(data);
            }}
            isLoading={isLoading}
            isSaving={companyProfileMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <InvoiceDefaultsForm
            defaultValues={{
              defaultCurrency: settings?.defaultCurrency,
              defaultPaymentTerms: settings?.defaultPaymentTerms,
              defaultTaxRate: settings?.defaultTaxRate
                ? Number(settings.defaultTaxRate)
                : undefined,
              invoicePrefix: settings?.invoicePrefix,
              quotationPrefix: settings?.quotationPrefix,
              invoiceNotes: settings?.invoiceNotes,
              invoiceTerms: settings?.invoiceTerms,
            }}
            onSubmit={async (data) => {
              await invoiceDefaultsMutation.mutateAsync(data);
            }}
            isLoading={isLoading}
            isSaving={invoiceDefaultsMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="einvoice" className="space-y-4">
          <EInvoiceSettingsForm
            defaultValues={{
              enabled: einvoiceSettings?.enabled ?? false,
              autoSubmit: einvoiceSettings?.autoSubmit ?? false,
              tin: einvoiceSettings?.tin ?? "",
              brn: einvoiceSettings?.brn ?? "",
              identificationScheme: einvoiceSettings?.identificationScheme ?? undefined,
              msicCode: einvoiceSettings?.msicCode ?? "",
              msicDescription: einvoiceSettings?.msicDescription ?? "",
              sstRegistration: einvoiceSettings?.sstRegistration,
              tourismTaxRegistration: einvoiceSettings?.tourismTaxRegistration,
            }}
            onSubmit={async (data) => {
              await einvoiceMutation.mutateAsync(data);
            }}
            isLoading={einvoiceLoading}
            isSaving={einvoiceMutation.isPending}
            validationErrors={einvoiceValidation?.errors ?? []}
          />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationSettingsForm
            defaultValues={{
              emailOnOverdue: settings?.emailOnOverdue ?? true,
              emailOnPayment: settings?.emailOnPayment ?? true,
              emailOnQuotationAccepted: settings?.emailOnQuotationAccepted ?? true,
              overdueReminderDays: settings?.overdueReminderDays,
            }}
            onSubmit={async (data) => {
              await notificationsMutation.mutateAsync(data);
            }}
            isLoading={isLoading}
            isSaving={notificationsMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <AppearanceSettingsForm
            defaultValues={{
              theme: settings?.theme as "light" | "dark" | "system" | undefined,
              dateFormat: settings?.dateFormat,
              numberFormat: settings?.numberFormat,
            }}
            onSubmit={async (data) => {
              await appearanceMutation.mutateAsync(data);
            }}
            isLoading={isLoading}
            isSaving={appearanceMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
