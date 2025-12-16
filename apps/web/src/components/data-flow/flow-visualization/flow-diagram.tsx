/**
 * Flow Diagram Component
 * Refined Sankey-style visualization with modern aesthetics
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, ArrowRight, GitBranch } from "@/components/ui/icons";
import { useDataFlowStats } from "@/api/data-flow";
import { SOURCE_CONFIG, CATEGORY_CONFIG } from "../shared/data-flow-constants";
import type { EventFilters } from "../shared/data-flow-types";

// Flow node and link types for this component
interface FlowNodeData {
  id: string;
  name: string;
  type: "source" | "resource" | "destination";
  category: string;
  color: string;
  count: number;
}

interface FlowLinkData {
  source: string;
  target: string;
  value: number;
  actions: string[];
}

// Calculated link with SVG positioning
interface CalculatedLink extends FlowLinkData {
  startY: number;
  endY: number;
  thickness: number;
  color: string;
}

interface FlowDiagramProps {
  filters: EventFilters;
  isPolling: boolean;
}

export function FlowDiagram({ filters, isPolling }: FlowDiagramProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const { data, isLoading } = useDataFlowStats(filters, {
    refetchInterval: isPolling ? 5000 : false,
  });

  // Group nodes by type
  const { sourceNodes, resourceNodes } = useMemo((): { sourceNodes: FlowNodeData[]; resourceNodes: FlowNodeData[] } => {
    if (!data?.flowStats.nodes) {
      return { sourceNodes: [], resourceNodes: [] };
    }

    return {
      sourceNodes: data.flowStats.nodes.filter((n: FlowNodeData) => n.type === "source") as FlowNodeData[],
      resourceNodes: data.flowStats.nodes.filter((n: FlowNodeData) => n.type === "resource") as FlowNodeData[],
    };
  }, [data?.flowStats.nodes]);

  // Calculate link paths
  const linkPaths = useMemo((): CalculatedLink[] => {
    if (!data?.flowStats.links || !sourceNodes.length || !resourceNodes.length) {
      return [];
    }

    const sourceHeight = 360;
    const targetHeight = 360;
    const sourceY = (index: number) => (sourceHeight / (sourceNodes.length + 1)) * (index + 1);
    const targetY = (index: number) => (targetHeight / (resourceNodes.length + 1)) * (index + 1);

    const maxValue = Math.max(...data.flowStats.links.map((l: FlowLinkData) => l.value), 1);

    return data.flowStats.links
      .map((link: FlowLinkData): CalculatedLink | null => {
        const sourceIndex = sourceNodes.findIndex((n: FlowNodeData) => n.id === link.source);
        const targetIndex = resourceNodes.findIndex((n: FlowNodeData) => n.id === link.target);

        if (sourceIndex === -1 || targetIndex === -1) return null;

        const startY = sourceY(sourceIndex);
        const endY = targetY(targetIndex);
        const thickness = Math.max(2, (link.value / maxValue) * 16);

        // Get source color
        const sourceId = link.source.replace("source:", "");
        const sourceConfig = SOURCE_CONFIG[sourceId as keyof typeof SOURCE_CONFIG];

        return {
          ...link,
          startY,
          endY,
          thickness,
          color: sourceConfig?.hexColor ?? "#94a3b8",
        };
      })
      .filter((link): link is CalculatedLink => link !== null);
  }, [data?.flowStats.links, sourceNodes, resourceNodes]);

  if (isLoading) {
    return <FlowDiagramSkeleton />;
  }

  if (!data || data.flowStats.summary.totalEvents === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card p-8"
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="size-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <GitBranch className="size-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No flow data available</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Data flows will be visualized here as events occur in your system
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Data Flow Visualization</h2>
          <p className="text-sm text-muted-foreground">
            {data.flowStats.summary.totalEvents.toLocaleString()} events flowing through your system
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1.5 text-xs font-normal cursor-help">
                <Info className="size-3" />
                How to read
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                Flow thickness represents event volume. Hover over nodes and paths
                to see detailed information about data movement.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Flow Diagram Container */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Stats Bar */}
        <div className="flex items-center gap-6 px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Sources</span>
            <span className="text-sm font-semibold tabular-nums">{sourceNodes.length}</span>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Resources</span>
            <span className="text-sm font-semibold tabular-nums">{resourceNodes.length}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Connections</span>
            <span className="text-sm font-semibold tabular-nums">{linkPaths.length}</span>
          </div>
        </div>

        {/* SVG Flow Diagram */}
        <div className="relative w-full p-4" style={{ height: "420px" }}>
          <svg
            viewBox="0 0 800 360"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Defs for gradients and filters */}
            <defs>
              {/* Drop shadow filter */}
              <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
              </filter>

              {/* Glow filter for hovered elements */}
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Links (Flow Paths) */}
            <g className="links">
              {linkPaths.map((link: CalculatedLink, i: number) => {
                const isHovered = hoveredLink === `${link.source}-${link.target}`;
                const isConnectedToHoveredNode =
                  hoveredNode === link.source || hoveredNode === link.target;

                return (
                  <g key={`link-${i}`}>
                    {/* Gradient definition */}
                    <defs>
                      <linearGradient
                        id={`flow-gradient-${i}`}
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor={link.color} stopOpacity="0.5" />
                        <stop offset="50%" stopColor={link.color} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={link.color} stopOpacity="0.15" />
                      </linearGradient>
                    </defs>

                    {/* Flow Path */}
                    <motion.path
                      d={`M 130 ${link.startY} C 350 ${link.startY}, 450 ${link.endY}, 620 ${link.endY}`}
                      fill="none"
                      stroke={`url(#flow-gradient-${i})`}
                      strokeWidth={link.thickness}
                      strokeLinecap="round"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: 1,
                        opacity: hoveredNode && !isConnectedToHoveredNode ? 0.15 : 1
                      }}
                      transition={{
                        pathLength: { duration: 0.8, delay: i * 0.05, ease: "easeOut" },
                        opacity: { duration: 0.2 }
                      }}
                      onMouseEnter={() => setHoveredLink(`${link.source}-${link.target}`)}
                      onMouseLeave={() => setHoveredLink(null)}
                      className="cursor-pointer"
                      filter={isHovered ? "url(#glow)" : undefined}
                    />

                    {/* Animated particles along path (only for hovered) */}
                    {isHovered && (
                      <motion.circle
                        r="4"
                        fill={link.color}
                        initial={{ offsetDistance: "0%" }}
                        animate={{ offsetDistance: "100%" }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        style={{
                          offsetPath: `path('M 130 ${link.startY} C 350 ${link.startY}, 450 ${link.endY}, 620 ${link.endY}')`,
                        }}
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* Source Nodes (Left Side) */}
            <g className="source-nodes">
              {sourceNodes.map((node: FlowNodeData, i: number) => {
                const y = (360 / (sourceNodes.length + 1)) * (i + 1);
                const sourceId = node.id.replace("source:", "");
                const config = SOURCE_CONFIG[sourceId as keyof typeof SOURCE_CONFIG];
                const isHovered = hoveredNode === node.id;

                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                  >
                    {/* Background glow on hover */}
                    {isHovered && (
                      <motion.circle
                        cx="80"
                        cy={y}
                        r="45"
                        fill={config?.hexColor ?? "#94a3b8"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.15 }}
                        exit={{ opacity: 0 }}
                      />
                    )}

                    {/* Node Circle */}
                    <motion.circle
                      cx="80"
                      cy={y}
                      r="28"
                      fill={config?.hexColor ?? "#94a3b8"}
                      filter="url(#nodeShadow)"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{
                        scale: isHovered ? 1.1 : 1,
                        opacity: 1
                      }}
                      transition={{
                        scale: { type: "spring", stiffness: 300, damping: 20 },
                        opacity: { duration: 0.3, delay: i * 0.1 }
                      }}
                    />

                    {/* Inner ring */}
                    <motion.circle
                      cx="80"
                      cy={y}
                      r="24"
                      fill="none"
                      stroke="white"
                      strokeWidth="1"
                      strokeOpacity="0.3"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.1 + 0.1 }}
                    />

                    {/* Count */}
                    <motion.text
                      x="80"
                      y={y + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-sm font-bold fill-white"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.1 + 0.2 }}
                    >
                      {node.count}
                    </motion.text>

                    {/* Label */}
                    <motion.text
                      x="80"
                      y={y + 48}
                      textAnchor="middle"
                      className="text-xs font-medium fill-foreground"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 + 0.2 }}
                    >
                      {config?.label ?? node.name}
                    </motion.text>
                  </g>
                );
              })}
            </g>

            {/* Resource Nodes (Right Side) */}
            <g className="resource-nodes">
              {resourceNodes.map((node: FlowNodeData, i: number) => {
                const y = (360 / (resourceNodes.length + 1)) * (i + 1);
                const categoryConfig = CATEGORY_CONFIG[node.category as keyof typeof CATEGORY_CONFIG];
                const isHovered = hoveredNode === node.id;
                const baseColor = categoryConfig?.hexColor ?? node.color;

                return (
                  <g
                    key={node.id}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                  >
                    {/* Background glow on hover */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.rect
                          x="612"
                          y={y - 28}
                          width="136"
                          height="56"
                          rx="12"
                          fill={baseColor}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 0.15 }}
                          exit={{ opacity: 0 }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Node Rectangle */}
                    <motion.rect
                      x="620"
                      y={y - 20}
                      width="120"
                      height="40"
                      rx="8"
                      fill={baseColor}
                      filter="url(#nodeShadow)"
                      initial={{ scaleX: 0, opacity: 0 }}
                      animate={{
                        scaleX: 1,
                        opacity: 1,
                        x: isHovered ? -4 : 0,
                        width: isHovered ? 128 : 120,
                      }}
                      transition={{
                        scaleX: { type: "spring", stiffness: 200, damping: 20, delay: i * 0.05 },
                        opacity: { duration: 0.3, delay: i * 0.05 }
                      }}
                      style={{ originX: 0 }}
                    />

                    {/* Node Label */}
                    <motion.text
                      x="680"
                      y={y - 2}
                      textAnchor="middle"
                      className="text-xs font-medium fill-white"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 + 0.2 }}
                    >
                      {node.name}
                    </motion.text>

                    {/* Count Badge */}
                    <motion.text
                      x="680"
                      y={y + 12}
                      textAnchor="middle"
                      className="text-[10px] fill-white/70"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 + 0.25 }}
                    >
                      {node.count} events
                    </motion.text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Hover tooltip */}
          <AnimatePresence>
            {hoveredLink && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-popover border rounded-lg shadow-lg px-4 py-3 z-10"
              >
                {(() => {
                  const link = linkPaths.find(
                    (l: CalculatedLink) => `${l.source}-${l.target}` === hoveredLink
                  );
                  if (!link) return null;
                  return (
                    <div className="text-center">
                      <p className="text-2xl font-semibold tabular-nums">{link.value}</p>
                      <p className="text-xs text-muted-foreground">events transferred</p>
                      {link.actions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 justify-center">
                          {link.actions.slice(0, 3).map((action: string) => (
                            <Badge key={action} variant="secondary" className="text-[10px]">
                              {action.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-6 px-6 py-4 border-t bg-muted/20">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Sources</span>
            <div className="flex items-center gap-3">
              {Object.entries(SOURCE_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: config.hexColor }}
                  />
                  <span className="text-xs text-muted-foreground">{config.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Categories</span>
            <div className="flex items-center gap-3">
              {Object.entries(CATEGORY_CONFIG).slice(0, 4).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div
                    className="size-2.5 rounded"
                    style={{ backgroundColor: config.hexColor }}
                  />
                  <span className="text-xs text-muted-foreground">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FlowDiagramSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-6 w-24" />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-6 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        <div className="h-[420px] p-8 flex items-center justify-center">
          <div className="flex items-center gap-16">
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="size-14 rounded-full" />
              ))}
            </div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-3 w-32 rounded-full" />
              ))}
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-28 rounded-lg" />
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-muted/20">
          <div className="flex gap-6">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
