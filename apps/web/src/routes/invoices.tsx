import { columns, columnConfig } from "@/components/table-columns/invoices";
import { toInvoices } from "@/types/common/invoice";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ReceiptIcon } from "@/assets/icons";
import { Plus } from "@/components/ui/icons";
import { useInvoices } from "@/api";
import { useAuth } from "@/providers/auth-provider";
import { Link } from "react-router-dom";

export function Invoices() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data: invoicesData, isLoading } = useInvoices({
    enabled: !!user && !isAuthLoading,
  });
  const invoices = toInvoices(invoicesData as Parameters<typeof toInvoices>[0]);

  const showSkeleton = isLoading || isAuthLoading;

  return (
    <PageContainer>
      <PageHeader
        icon={ReceiptIcon}
        title="Invoices"
        description="Manage and track all your invoices"
        action={
          showSkeleton ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <Link to="/create/invoice">
              <Button>
                <Plus className="size-4" />
                New Invoice
              </Button>
            </Link>
          )
        }
      />

      {showSkeleton ? (
        <DataTable
          columns={columns}
          data={[]}
          columnConfig={columnConfig}
          isLoading={true}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      ) : !invoices?.length ? (
        <EmptyState
          icon={ReceiptIcon}
          title="No invoices yet"
          description="Create your first invoice to start tracking your payments and growing your business."
          action={
            <Link to="/create/invoice">
              <Button>
                <Plus className="size-4" />
                Create Invoice
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          columnConfig={columnConfig}
          isLoading={false}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      )}
    </PageContainer>
  );
}
