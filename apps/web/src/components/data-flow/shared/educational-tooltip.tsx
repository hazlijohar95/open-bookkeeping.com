/**
 * Educational Tooltip Component
 * Provides contextual learning content for actions and entities
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  HelpCircle,
  BookOpen,
  ArrowRight,
  DollarSign,
} from "@/components/ui/icons";
import {
  ACTION_EDUCATION,
  ENTITY_DEFINITIONS,
  type EntityDefinition,
} from "./data-flow-constants";
import { cn } from "@/lib/utils";

interface EducationalTooltipProps {
  type: "action" | "entity";
  id: string;
  children: React.ReactNode;
  className?: string;
}

type ActionContent = (typeof ACTION_EDUCATION)[keyof typeof ACTION_EDUCATION];

export function EducationalTooltip({
  type,
  id,
  children,
  className,
}: EducationalTooltipProps) {
  const content =
    type === "action"
      ? ACTION_EDUCATION[id]
      : ENTITY_DEFINITIONS.find((e) => e.id === id);

  if (!content) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex cursor-help items-center gap-1",
              className
            )}
          >
            {children}
            <HelpCircle className="text-muted-foreground size-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-sm space-y-3 p-4"
          sideOffset={5}
        >
          {type === "action" && "name" in content && (
            <ActionEducationContent content={content} />
          )}
          {type === "entity" && "displayName" in content && (
            <EntityEducationContent content={content} />
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ActionEducationContent({ content }: { content: ActionContent }) {
  return (
    <>
      <div>
        <p className="font-medium">{content.name}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {content.description}
        </p>
      </div>

      {content.dataImpact.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            Data Impact:
          </p>
          <ul className="space-y-0.5 text-sm">
            {content.dataImpact.map((impact: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5">
                <ArrowRight className="text-primary mt-1 size-3 shrink-0" />
                {impact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {content.financialEffect && (
        <div className="flex items-start gap-2 rounded bg-green-50 p-2 dark:bg-green-950/30">
          <DollarSign className="mt-0.5 size-4 shrink-0 text-green-600" />
          <p className="text-sm text-green-700 dark:text-green-300">
            {content.financialEffect}
          </p>
        </div>
      )}

      {content.accountingEntry && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-blue-50 p-2 dark:bg-blue-950/30">
            <p className="mb-1 font-medium text-blue-700 dark:text-blue-300">
              Debit
            </p>
            {content.accountingEntry.debits.map((item: string, i: number) => (
              <p key={i} className="text-blue-600 dark:text-blue-400">
                {item}
              </p>
            ))}
          </div>
          <div className="rounded bg-amber-50 p-2 dark:bg-amber-950/30">
            <p className="mb-1 font-medium text-amber-700 dark:text-amber-300">
              Credit
            </p>
            {content.accountingEntry.credits.map((item: string, i: number) => (
              <p key={i} className="text-amber-600 dark:text-amber-400">
                {item}
              </p>
            ))}
          </div>
        </div>
      )}

      {content.relatedTables.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {content.relatedTables.map((table: string) => (
            <Badge key={table} variant="outline" className="text-xs">
              {table}
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}

function EntityEducationContent({ content }: { content: EntityDefinition }) {
  return (
    <>
      <div>
        <p className="font-medium">{content.displayName}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {content.description}
        </p>
      </div>

      <div className="bg-muted/50 rounded p-2">
        <p className="text-muted-foreground mb-1 text-xs font-medium">
          Data Flow:
        </p>
        <p className="font-mono text-sm">{content.education.dataFlow}</p>
      </div>

      {content.education.relatedReports.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <BookOpen className="text-muted-foreground size-3" />
          {content.education.relatedReports.map((report: string) => (
            <Badge key={report} variant="secondary" className="text-xs">
              {report}
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}
