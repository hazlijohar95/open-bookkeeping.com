import type { ReactNode } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogHeaderContainer,
  DialogIcon,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrashIcon } from "@/assets/icons";

/**
 * Props for the ConfirmDeleteModal component.
 *
 * @example
 * // Basic usage with entity name
 * <ConfirmDeleteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleDelete}
 *   title="Delete Customer"
 *   entityName={customer.name}
 *   isLoading={mutation.isPending}
 * />
 *
 * @example
 * // Usage with custom description
 * <ConfirmDeleteModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={handleDelete}
 *   title="Delete API Key"
 *   description="This will revoke access for all applications using this key."
 *   isLoading={mutation.isPending}
 *   confirmText="Revoke"
 *   loadingText="Revoking..."
 * />
 */
export interface ConfirmDeleteModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when delete is confirmed */
  onConfirm: () => void;
  /** Modal title (e.g., "Delete Customer") */
  title: string;
  /**
   * Custom description. If not provided, a default message will be generated
   * using entityName: "Are you sure you want to delete {entityName}? This action cannot be undone."
   */
  description?: ReactNode;
  /** Entity name to display in the default description (e.g., customer.name) */
  entityName?: string;
  /** Whether the delete operation is in progress */
  isLoading?: boolean;
  /** Custom confirm button text (default: "Delete") */
  confirmText?: string;
  /** Custom loading text (default: "Deleting...") */
  loadingText?: string;
  /** Custom icon (default: TrashIcon) */
  icon?: ReactNode;
}

/**
 * A reusable confirmation modal for delete operations.
 *
 * Features:
 * - Consistent UI with icon header
 * - Loading state support
 * - Customizable text and description
 * - Accessible with proper ARIA attributes
 */
export function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  entityName,
  isLoading = false,
  confirmText = "Delete",
  loadingText = "Deleting...",
  icon,
}: ConfirmDeleteModalProps) {
  // Generate default description if not provided
  const defaultDescription = entityName ? (
    <>
      Are you sure you want to delete <strong>{entityName}</strong>? This action
      cannot be undone.
    </>
  ) : (
    "Are you sure you want to proceed? This action cannot be undone."
  );

  const displayDescription = description ?? defaultDescription;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeaderContainer>
          <DialogIcon>{icon ?? <TrashIcon />}</DialogIcon>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{displayDescription}</div>
            </DialogDescription>
          </DialogHeader>
        </DialogHeaderContainer>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isLoading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? loadingText : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook helper type for creating delete modal state
 */
export interface DeleteModalState<T> {
  isOpen: boolean;
  entity: T | null;
}

/**
 * Helper function to create initial delete modal state
 */
export function createDeleteModalState<T>(): DeleteModalState<T> {
  return { isOpen: false, entity: null };
}
