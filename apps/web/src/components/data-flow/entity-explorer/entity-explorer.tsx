/**
 * Entity Explorer Component
 * Refined interactive explorer for database entities with modern aesthetics
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FileText,
  Users,
  Truck,
  Receipt,
  BookOpen,
  DollarSign,
  ArrowRight,
  Info,
  Link2,
  Database,
  ChevronRight,
  X,
} from "@/components/ui/icons";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { useEntityRelationships, useResourceTypeInfo } from "@/api/data-flow";
import {
  ENTITY_DEFINITIONS,
  CATEGORY_CONFIG,
} from "../shared/data-flow-constants";
import { cn } from "@/lib/utils";

// Types for entity relationships
interface EntityRelation {
  target: string;
  type: string;
  label: string;
}

interface Entity {
  id: string;
  displayName: string;
  category: string;
  relations: EntityRelation[];
}

// Icon mapping for entities
const ENTITY_ICONS: Record<string, PhosphorIcon> = {
  customer: Users,
  vendor: Truck,
  invoice: FileText,
  quotation: FileText,
  bill: Receipt,
  journal_entry: BookOpen,
  account: DollarSign,
  ledger: Database,
  credit_note: FileText,
  payment: DollarSign,
};

export function EntityExplorer() {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { data: relationships, isLoading } = useEntityRelationships();
  const { data: entityInfo } = useResourceTypeInfo(selectedEntity ?? "", {
    enabled: !!selectedEntity,
  });

  // Group entities by category
  const entitiesByCategory = useMemo(() => {
    if (!relationships?.entities) return {} as Record<string, Entity[]>;

    return relationships.entities.reduce(
      (acc: Record<string, Entity[]>, entity: Entity) => {
        const category = entity.category;
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(entity);
        return acc;
      },
      {} as Record<string, Entity[]> // eslint-disable-line @typescript-eslint/prefer-reduce-type-parameter
    );
  }, [relationships?.entities]);

  // Get selected entity details
  const selectedEntityData = useMemo((): Entity | null => {
    if (!selectedEntity || !relationships?.entities) return null;
    return (
      relationships.entities.find((e: Entity) => e.id === selectedEntity) ??
      null
    );
  }, [selectedEntity, relationships?.entities]);

  // Get relations involving selected entity
  const selectedEntityRelations = useMemo((): EntityRelation[] => {
    if (!selectedEntity || !relationships?.entities) return [];

    const entity = relationships.entities.find(
      (e: Entity) => e.id === selectedEntity
    );
    if (!entity) return [];

    return entity.relations;
  }, [selectedEntity, relationships?.entities]);

  // Total entities count
  const totalEntities = useMemo(() => {
    return relationships?.entities?.length ?? 0;
  }, [relationships?.entities]);

  if (isLoading) {
    return <EntityExplorerSkeleton />;
  }

  const categories = Object.keys(entitiesByCategory);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Entity Explorer</h2>
            <p className="text-muted-foreground text-sm">
              Discover how {totalEntities} database entities connect and relate
            </p>
          </div>
          {selectedEntity && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEntity(null)}
              className="gap-2"
            >
              <X className="size-3" />
              Clear selection
            </Button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeCategory === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            All ({totalEntities})
          </button>
          {categories.map((category) => {
            const categoryConfig =
              CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
            const count = entitiesByCategory[category]?.length ?? 0;

            return (
              <button
                key={category}
                onClick={() =>
                  setActiveCategory(
                    activeCategory === category ? null : category
                  )
                }
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  activeCategory === category
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor: categoryConfig?.hexColor ?? "#94a3b8",
                  }}
                />
                {categoryConfig?.label ?? category}
                <span className="text-xs opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Entity Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {Object.entries(entitiesByCategory)
              .filter(
                ([category]) =>
                  activeCategory === null || category === activeCategory
              )
              .flatMap(([category, categoryEntities]: [string, Entity[]]) =>
                categoryEntities.map((entity: Entity) => {
                  const Icon = ENTITY_ICONS[entity.id] ?? Database;
                  const isSelected = selectedEntity === entity.id;
                  const entityDef = ENTITY_DEFINITIONS.find(
                    (e) => e.id === entity.id
                  );
                  const categoryConfig =
                    CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];

                  return (
                    <motion.button
                      key={entity.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setSelectedEntity(entity.id)}
                      className={cn(
                        "group bg-card relative rounded-xl border p-4 text-left transition-all duration-200",
                        "hover:border-primary/30 hover:shadow-md",
                        isSelected &&
                          "ring-primary border-primary shadow-md ring-2"
                      )}
                    >
                      {/* Category indicator */}
                      <div
                        className="absolute top-0 right-4 left-4 h-1 rounded-b-full opacity-60 transition-opacity group-hover:opacity-100"
                        style={{
                          backgroundColor:
                            categoryConfig?.hexColor ?? "#94a3b8",
                        }}
                      />

                      <div className="pt-2">
                        {/* Icon and name */}
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted group-hover:bg-muted/80"
                            )}
                          >
                            <Icon className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">
                                {entity.displayName}
                              </p>
                              <ChevronRight
                                className={cn(
                                  "text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100",
                                  isSelected && "text-primary opacity-100"
                                )}
                              />
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="h-5 px-1.5 py-0 text-[10px]"
                              >
                                {entity.relations.length} link
                                {entity.relations.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        {entityDef && (
                          <p className="text-muted-foreground mt-3 line-clamp-2 text-xs leading-relaxed">
                            {entityDef.description}
                          </p>
                        )}
                      </div>
                    </motion.button>
                  );
                })
              )}
          </AnimatePresence>
        </div>

        {/* Selected Entity Relationships */}
        <AnimatePresence>
          {selectedEntity && selectedEntityRelations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-card rounded-xl border p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="bg-primary/10 flex size-8 items-center justify-center rounded-lg">
                    <Link2 className="text-primary size-4" />
                  </div>
                  <div>
                    <h3 className="font-medium">
                      Connections from {selectedEntityData?.displayName}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {selectedEntityRelations.length} related entities
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedEntityRelations.map(
                    (relation: EntityRelation, i: number) => {
                      const targetEntity = relationships?.entities.find(
                        (e: Entity) => e.id === relation.target
                      );
                      const TargetIcon =
                        ENTITY_ICONS[relation.target] ?? Database;

                      return (
                        <motion.button
                          key={`${relation.target}-${i}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => setSelectedEntity(relation.target)}
                          className="bg-muted/30 hover:bg-muted/50 group flex items-center gap-3 rounded-lg border p-3 text-left transition-colors"
                        >
                          <ArrowRight className="text-muted-foreground size-4 shrink-0" />
                          <div className="bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border">
                            <TargetIcon className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="group-hover:text-primary truncate text-sm font-medium transition-colors">
                              {targetEntity?.displayName ?? relation.target}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {relation.label}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px]"
                          >
                            {relation.type.replace(/_/g, " ")}
                          </Badge>
                        </motion.button>
                      );
                    }
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Entity Detail Sheet */}
      <Sheet
        open={!!selectedEntity}
        onOpenChange={(open) => !open && setSelectedEntity(null)}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {selectedEntityData && (
                <>
                  <div className="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
                    {(() => {
                      const Icon =
                        ENTITY_ICONS[selectedEntity ?? ""] ?? Database;
                      return <Icon className="text-primary size-5" />;
                    })()}
                  </div>
                  {selectedEntityData.displayName}
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              Learn how this entity works and connects to your data
            </SheetDescription>
          </SheetHeader>

          {entityInfo && (
            <div className="mt-6 space-y-6">
              {/* Description Card */}
              <div className="bg-muted/30 rounded-lg p-4">
                <p className="text-sm leading-relaxed">
                  {entityInfo.description}
                </p>
              </div>

              {/* What It Does */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded bg-blue-500/10">
                    <Info className="size-3.5 text-blue-500" />
                  </div>
                  <h4 className="text-sm font-medium">What it does</h4>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {entityInfo.whatItDoes}
                </p>
              </div>

              {/* Data Flow */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex size-6 items-center justify-center rounded bg-violet-500/10">
                    <ArrowRight className="size-3.5 text-violet-500" />
                  </div>
                  <h4 className="text-sm font-medium">Data Flow</h4>
                </div>
                <div className="bg-muted/50 rounded-lg border p-3">
                  <p className="text-muted-foreground font-mono text-sm">
                    {entityInfo.dataFlow}
                  </p>
                </div>
              </div>

              {/* Related Reports */}
              {entityInfo.relatedReports.length > 0 && (
                <div>
                  <h4 className="mb-3 text-sm font-medium">Related Reports</h4>
                  <div className="flex flex-wrap gap-2">
                    {entityInfo.relatedReports.map((report: string) => (
                      <Badge
                        key={report}
                        variant="secondary"
                        className="font-normal"
                      >
                        {report}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Relationships */}
              {selectedEntityRelations.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <Link2 className="size-4" />
                    Relationships ({selectedEntityRelations.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedEntityRelations.map(
                      (relation: EntityRelation, i: number) => {
                        const targetEntity = relationships?.entities.find(
                          (e: Entity) => e.id === relation.target
                        );
                        const TargetIcon =
                          ENTITY_ICONS[relation.target] ?? Database;

                        return (
                          <Button
                            key={i}
                            variant="outline"
                            className="h-auto w-full justify-start gap-3 py-3"
                            onClick={() => setSelectedEntity(relation.target)}
                          >
                            <div className="bg-muted flex size-8 items-center justify-center rounded-lg">
                              <TargetIcon className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <p className="truncate font-medium">
                                {targetEntity?.displayName ?? relation.target}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {relation.label}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className="shrink-0 text-[10px]"
                            >
                              {relation.type.replace(/_/g, " ")}
                            </Badge>
                          </Button>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function EntityExplorerSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-lg" />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl border p-4">
            <div className="flex items-start gap-3">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            </div>
            <Skeleton className="mt-3 h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
