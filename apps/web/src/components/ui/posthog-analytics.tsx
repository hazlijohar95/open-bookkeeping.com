import * as React from "react";
import { posthog } from "@/providers/posthog-provider";
import { IAnalytics } from "@/types";

interface PostHogAnalyticsProps extends React.HTMLAttributes<HTMLDivElement> {
  analytics?: IAnalytics;
  as?: React.ElementType;
}

function PostHogAnalytics({ className, analytics, onClick, as: Component = "div", children, ...props }: PostHogAnalyticsProps) {
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (analytics?.name) {
        posthog.capture(analytics.name, { group: analytics.group });
      }
      onClick?.(event);
    },
    [analytics, onClick],
  );

  return <Component className={className} onClick={handleClick} {...props}>{children}</Component>;
}

export { PostHogAnalytics };
