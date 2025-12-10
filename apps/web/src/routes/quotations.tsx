import { columns, columnConfig } from "@/components/table-columns/quotations";
import { toQuotations } from "@/types/common/quotation";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FileFeatherIcon } from "@/assets/icons";
import { Plus } from "@/components/ui/icons";
import { useQuotations } from "@/api";
import { useAuth } from "@/providers/auth-provider";
import { Link } from "react-router-dom";

export function Quotations() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data: quotationsData, isLoading } = useQuotations({
    enabled: !!user && !isAuthLoading,
  });
  const quotations = toQuotations(quotationsData as Parameters<typeof toQuotations>[0]);

  const showSkeleton = isLoading || isAuthLoading;

  return (
    <PageContainer>
      <PageHeader
        icon={FileFeatherIcon}
        title="Quotations"
        description="Create and manage quotes for your clients"
        action={
          showSkeleton ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <Link to="/create/quotation">
              <Button>
                <Plus className="size-4" />
                New Quotation
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
      ) : !quotations?.length ? (
        <EmptyState
          icon={FileFeatherIcon}
          title="No quotations yet"
          description="Create your first quotation to start sending professional quotes to your clients."
          action={
            <Link to="/create/quotation">
              <Button>
                <Plus className="size-4" />
                Create Quotation
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={quotations}
          columnConfig={columnConfig}
          isLoading={false}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      )}
    </PageContainer>
  );
}
