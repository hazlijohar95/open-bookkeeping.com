import { columns, columnConfig } from "@/components/table-columns/debit-notes";
import { toDebitNotes, type DebitNoteApiResponse } from "@/types/common/debitNote";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { FileFeatherIcon } from "@/assets/icons";
import { Plus } from "@/components/ui/icons";
import { useDebitNotes } from "@/api/debit-notes";
import { useAuth } from "@/providers/auth-provider";
import { Link } from "react-router-dom";

export function DebitNotes() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: debitNotesData, isLoading } = useDebitNotes({
    enabled: !!user && !isAuthLoading,
  });
  const debitNotes = toDebitNotes(debitNotesData as DebitNoteApiResponse[] | undefined);

  const showSkeleton = isLoading || isAuthLoading;

  return (
    <PageContainer>
      <PageHeader
        icon={FileFeatherIcon}
        title="Debit Notes"
        description="Manage and track all your debit notes"
        action={
          showSkeleton ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <Link to="/create/debit-note">
              <Button>
                <Plus className="size-4" />
                New Debit Note
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
      ) : !debitNotes?.length ? (
        <EmptyState
          icon={FileFeatherIcon}
          title="No debit notes yet"
          description="Create your first debit note to add debits to your customers."
          action={
            <Link to="/create/debit-note">
              <Button>
                <Plus className="size-4" />
                Create Debit Note
              </Button>
            </Link>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={debitNotes}
          columnConfig={columnConfig}
          isLoading={false}
          defaultSorting={[{ id: "createdAt", desc: true }]}
        />
      )}
    </PageContainer>
  );
}
