import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "./table-skeleton";

interface PageSkeletonProps {
  title: string;
  description?: string;
  rows?: number;
}

export function PageSkeleton({ title, description, rows = 10 }: PageSkeletonProps) {
  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={description}
        action={<Skeleton className="h-9 w-32" />}
      />
      <TableSkeleton rows={rows} />
    </PageContainer>
  );
}
