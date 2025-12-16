/**
 * Event Timeline Component
 * Chronological stream of events with refined visual design
 */

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Search, X } from "@/components/ui/icons";
import { EventCard } from "./event-card";
import { SOURCE_CONFIG } from "../shared/data-flow-constants";
import type { UnifiedEvent, EventFilters } from "../shared/data-flow-types";

interface EventTimelineProps {
  events: UnifiedEvent[];
  isLoading: boolean;
  hasMore: boolean;
  filterOptions?: {
    resourceTypes: string[];
    actionTypes: string[];
  };
  onFilterChange: (filters: Partial<EventFilters>) => void;
  onLoadMore?: () => void;
}

export function EventTimeline({
  events,
  isLoading,
  hasMore,
  filterOptions,
  onFilterChange,
  onLoadMore,
}: EventTimelineProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [selectedResourceType, setSelectedResourceType] = useState<string>("all");

  // Filter events locally for search
  const filteredEvents = events.filter((event) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        event.action.toLowerCase().includes(query) ||
        event.resourceType.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        (event.metadata.reasoning?.toLowerCase().includes(query) ?? false)
      );
    }
    return true;
  });

  const handleSourceChange = (value: string) => {
    setSelectedSource(value);
    if (value === "all") {
      onFilterChange({ sources: ["agent", "user"] });
    } else {
      onFilterChange({ sources: [value as "agent" | "user" | "admin"] });
    }
  };

  const handleResourceTypeChange = (value: string) => {
    setSelectedResourceType(value);
    if (value === "all") {
      onFilterChange({ resourceTypes: undefined });
    } else {
      onFilterChange({ resourceTypes: [value] });
    }
  };

  const hasActiveFilters = selectedSource !== "all" || selectedResourceType !== "all" || searchQuery;

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedSource("all");
    setSelectedResourceType("all");
    onFilterChange({ sources: ["agent", "user"], resourceTypes: undefined });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Event Stream</h2>
          <p className="text-sm text-muted-foreground">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
            {hasActiveFilters && " (filtered)"}
          </p>
        </div>
        <Button
          variant={showFilters ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="size-4" />
          Filters
          {hasActiveFilters && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
              {[selectedSource !== "all", selectedResourceType !== "all", searchQuery].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
              <div className="flex flex-wrap gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search events..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-background"
                  />
                </div>

                {/* Source Filter */}
                <Select value={selectedSource} onValueChange={handleSourceChange}>
                  <SelectTrigger className="w-[140px] bg-background">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="agent">AI Agent</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>

                {/* Resource Type Filter */}
                <Select value={selectedResourceType} onValueChange={handleResourceTypeChange}>
                  <SelectTrigger className="w-[160px] bg-background">
                    <SelectValue placeholder="Resource Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {filterOptions?.resourceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Active Filters */}
              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Active filters:</span>
                  {selectedSource !== "all" && (
                    <Badge variant="secondary" className="gap-1 pl-2">
                      {SOURCE_CONFIG[selectedSource as keyof typeof SOURCE_CONFIG]?.label ?? selectedSource}
                      <button
                        onClick={() => handleSourceChange("all")}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )}
                  {selectedResourceType !== "all" && (
                    <Badge variant="secondary" className="gap-1 pl-2">
                      {selectedResourceType}
                      <button
                        onClick={() => handleResourceTypeChange("all")}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )}
                  {searchQuery && (
                    <Badge variant="secondary" className="gap-1 pl-2">
                      "{searchQuery}"
                      <button
                        onClick={() => setSearchQuery("")}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )}
                  <button
                    onClick={clearFilters}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredEvents.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="size-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No events found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasActiveFilters
              ? "Try adjusting your filters"
              : "Events will appear here as they occur"}
          </p>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
              Clear filters
            </Button>
          )}
        </motion.div>
      )}

      {/* Event List */}
      {!isLoading && filteredEvents.length > 0 && (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {filteredEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                >
                  <EventCard event={event} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Load More */}
          {hasMore && onLoadMore && (
            <div className="pt-6 text-center">
              <Button variant="outline" onClick={onLoadMore} className="gap-2">
                Load more events
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventCardSkeleton() {
  return (
    <div className="flex gap-4 pl-10 py-3">
      <Skeleton className="size-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-16 shrink-0" />
    </div>
  );
}
