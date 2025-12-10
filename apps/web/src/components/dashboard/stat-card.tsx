import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "@/components/ui/icons";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
  };
  description?: string;
  subdescription?: string;
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export const StatCard = memo(function StatCard({
  label,
  value,
  trend,
  description,
  subdescription,
  icon,
  className,
  isLoading = false,
}: StatCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("@container/card", className)}>
        <CardHeader className="relative">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-32" />
          <div className="absolute right-4 top-4">
            <Skeleton className="h-5 w-16 rounded-lg" />
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-44" />
        </CardFooter>
      </Card>
    );
  }

  const TrendIcon = trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : null;

  return (
    <Card className={cn("@container/card", className)}>
      <CardHeader className="relative">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {value}
        </CardTitle>
        {trend && (
          <div className="absolute right-4 top-4">
            <Badge variant="outline" className="flex gap-1 rounded-lg text-xs">
              {TrendIcon && <TrendIcon className="size-3" />}
              {trend.direction === "up" ? "+" : trend.direction === "down" ? "-" : ""}
              {Math.abs(trend.value)}%
            </Badge>
          </div>
        )}
      </CardHeader>
      {(description || subdescription) && (
        <CardFooter className="flex-col items-start gap-1 text-sm">
          {description && (
            <div className="line-clamp-1 flex gap-2 font-medium">
              {description}
              {icon}
            </div>
          )}
          {subdescription && (
            <div className="text-muted-foreground">{subdescription}</div>
          )}
        </CardFooter>
      )}
    </Card>
  );
});
