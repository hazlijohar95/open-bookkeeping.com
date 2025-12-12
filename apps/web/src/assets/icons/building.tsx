import type { IconProps } from "@/types";
import { cn } from "@/lib/utils";

function Building({ fill = "currentColor", secondaryfill, className, ...props }: IconProps) {
  secondaryfill = secondaryfill ?? fill;

  return (
    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={cn("size-[18px]", className)} {...props}>
      <g fill={fill}>
        <path
          d="M3 4.75C3 3.2312 4.2312 2 5.75 2H12.25C13.7688 2 15 3.2312 15 4.75V15.25C15 15.6642 14.6642 16 14.25 16H3.75C3.33579 16 3 15.6642 3 15.25V4.75Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M5.5 5.25C5.5 4.83579 5.83579 4.5 6.25 4.5H7.25C7.66421 4.5 8 4.83579 8 5.25C8 5.66421 7.66421 6 7.25 6H6.25C5.83579 6 5.5 5.66421 5.5 5.25Z"
          fill={fill}
        />
        <path
          d="M10 5.25C10 4.83579 10.3358 4.5 10.75 4.5H11.75C12.1642 4.5 12.5 4.83579 12.5 5.25C12.5 5.66421 12.1642 6 11.75 6H10.75C10.3358 6 10 5.66421 10 5.25Z"
          fill={fill}
        />
        <path
          d="M5.5 8.25C5.5 7.83579 5.83579 7.5 6.25 7.5H7.25C7.66421 7.5 8 7.83579 8 8.25C8 8.66421 7.66421 9 7.25 9H6.25C5.83579 9 5.5 8.66421 5.5 8.25Z"
          fill={fill}
        />
        <path
          d="M10 8.25C10 7.83579 10.3358 7.5 10.75 7.5H11.75C12.1642 7.5 12.5 7.83579 12.5 8.25C12.5 8.66421 12.1642 9 11.75 9H10.75C10.3358 9 10 8.66421 10 8.25Z"
          fill={fill}
        />
        <path
          d="M7.5 12.75C7.5 12.0596 8.05964 11.5 8.75 11.5H9.25C9.94036 11.5 10.5 12.0596 10.5 12.75V16H7.5V12.75Z"
          fill={fill}
        />
      </g>
    </svg>
  );
}

export default Building;
