import { IconProps } from "@/types";
import { cn } from "@/lib/utils";

function TrendingUp({ fill = "currentColor", secondaryfill, className, ...props }: IconProps) {
  secondaryfill = secondaryfill || fill;

  return (
    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={cn("size-[18px]", className)} {...props}>
      <g fill={fill}>
        <path
          d="M2 13.25C2 14.7688 3.2312 16 4.75 16H13.25C14.7688 16 16 14.7688 16 13.25V4.75C16 3.2312 14.7688 2 13.25 2H4.75C3.2312 2 2 3.2312 2 4.75V13.25Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M11.5 6C11.5 5.58579 11.8358 5.25 12.25 5.25H14.25C14.6642 5.25 15 5.58579 15 6V8C15 8.41421 14.6642 8.75 14.25 8.75C13.8358 8.75 13.5 8.41421 13.5 8V7.81066L10.7803 10.5303C10.4874 10.8232 10.0126 10.8232 9.71967 10.5303L8 8.81066L5.28033 11.5303C4.98744 11.8232 4.51256 11.8232 4.21967 11.5303C3.92678 11.2374 3.92678 10.7626 4.21967 10.4697L7.46967 7.21967C7.76256 6.92678 8.23744 6.92678 8.53033 7.21967L10.25 8.93934L12.4393 6.75H12.25C11.8358 6.75 11.5 6.41421 11.5 6Z"
          fill={fill}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

export default TrendingUp;
