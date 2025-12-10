import { PageContainer } from "./page-container";
import { PageHeader } from "./page-header";

interface PageLoadingSpinnerProps {
  title?: string;
  description?: string;
}

export function PageLoadingSpinner({ title, description }: PageLoadingSpinnerProps) {
  return (
    <PageContainer>
      {title && <PageHeader title={title} description={description} />}
      <div className="flex items-center justify-center py-12">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    </PageContainer>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  );
}
