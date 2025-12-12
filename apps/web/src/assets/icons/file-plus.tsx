import type { IconProps } from "@/types";
import { cn } from "@/lib/utils";

function FilePlus({ fill = "currentColor", secondaryfill, className, ...props }: IconProps) {
  secondaryfill = secondaryfill ?? fill;

  return (
    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={cn("size-[18px]", className)} {...props}>
      <g fill={fill}>
        <path
          d="M11.572 1.512L15.487 5.427C15.8155 5.7553 16 6.2009 16 6.6655V14.25C16 15.7688 14.7688 17 13.25 17H4.75C3.2312 17 2 15.7688 2 14.25V3.75C2 2.2312 3.2312 1 4.75 1H10.336C10.7996 1 11.2442 1.1841 11.572 1.512Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M15.8691 6.00098H12C11.45 6.00098 11 5.55098 11 5.00098V1.13101C11.212 1.21806 11.4068 1.34677 11.572 1.512L15.487 5.427C15.6527 5.59266 15.7818 5.7882 15.8691 6.00098Z"
          fill={fill}
        />
        <path
          d="M9 8C9.41421 8 9.75 8.33579 9.75 8.75V10.25H11.25C11.6642 10.25 12 10.5858 12 11C12 11.4142 11.6642 11.75 11.25 11.75H9.75V13.25C9.75 13.6642 9.41421 14 9 14C8.58579 14 8.25 13.6642 8.25 13.25V11.75H6.75C6.33579 11.75 6 11.4142 6 11C6 10.5858 6.33579 10.25 6.75 10.25H8.25V8.75C8.25 8.33579 8.58579 8 9 8Z"
          fill={fill}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

export default FilePlus;
