import { columns, columnConfig } from "@/components/table-columns/credit-notes";
import { toCreditNotes, type CreditNoteApiResponse } from "@/types/common/creditNote";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FileFeatherIcon } from "@/assets/icons";
import { Plus } from "@/components/ui/icons";
import { useCreditNotes } from "@/api/credit-notes";
import { useAuth } from "@/providers/auth-provider";
import { Link } from "react-router-dom";

export function CreditNotes() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: creditNotesData, isLoading } = useCreditNotes({
    enabled: !!user && !isAuthLoading,
  });
  const creditNotes = toCreditNotes(creditNotesData as CreditNoteApiResponse[] | undefined);

  const showSkeleton = isLoading || isAuthLoading;

  return (
    <PageContainer>
      <PageHeader
        icon={FileFeatherIcon}
        title="Credit Notes"
        description="Manage and track all your credit notes"
        action={
          showSkeleton ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <Link to="/create/credit-note">
              <Button>
                <Plus className="size-4" />
                New Credit Note
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
      ) : !creditNotes?.length ? (
        <EmptyState
          icon={FileFeatherIcon}
          title="No credit notes yet"
          description="Create your first credit note to issue credits to your customers."
          action={
            <Link to="/create/credit-note">
              <Button>
                <Plus className="size-4" />
                Create Credit Note
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={creditNotes}
          columnConfig={columnConfig}
          isLoading={false}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      )}
    </PageContainer>
  );
}
