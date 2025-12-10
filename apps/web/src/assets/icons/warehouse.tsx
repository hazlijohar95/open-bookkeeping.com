import { IconProps } from "@/types";
import { cn } from "@/lib/utils";

function Warehouse({ fill = "currentColor", secondaryfill, className, ...props }: IconProps) {
  secondaryfill = secondaryfill || fill;

  return (
    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={cn("size-[18px]", className)} {...props}>
      <g fill={fill}>
        {/* Roof */}
        <path
          d="M9 2L2 7V8H16V7L9 2Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        {/* Building body */}
        <path
          d="M3 8V15.25C3 15.6642 3.33579 16 3.75 16H14.25C14.6642 16 15 15.6642 15 15.25V8H3Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        {/* Warehouse doors */}
        <path
          d="M5 10.5C5 10.2239 5.22386 10 5.5 10H7.5C7.77614 10 8 10.2239 8 10.5V16H5V10.5Z"
          fill={fill}
        />
        <path
          d="M10 10.5C10 10.2239 10.2239 10 10.5 10H12.5C12.7761 10 13 10.2239 13 10.5V16H10V10.5Z"
          fill={fill}
        />
        {/* Roof accent line */}
        <path
          d="M9 2.5L2.5 7H15.5L9 2.5Z"
          fill={fill}
          fillOpacity="0.8"
        />
      </g>
    </svg>
  );
}

export default Warehouse;
