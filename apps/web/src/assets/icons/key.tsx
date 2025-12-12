import type { IconProps } from "@/types";
import { cn } from "@/lib/utils";

function Key({ fill = "currentColor", secondaryfill, className, ...props }: IconProps) {
  secondaryfill = secondaryfill ?? fill;

  return (
    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={cn("size-[18px]", className)} {...props}>
      <g fill={fill}>
        <path
          d="M12.25 2C9.90279 2 8 3.90279 8 6.25C8 6.66895 8.05952 7.07339 8.17046 7.45544L2.21967 13.4062C2.07902 13.5469 2 13.738 2 13.9375V15.25C2 15.6642 2.33579 16 2.75 16H5.25C5.66421 16 6 15.6642 6 15.25V14.5H6.75C7.16421 14.5 7.5 14.1642 7.5 13.75V13H8.25C8.44891 13 8.63968 12.921 8.78033 12.7803L10.5446 11.0167C10.9266 11.1205 11.331 11.1736 11.75 11.1736C14.0972 11.1736 16 9.27084 16 6.92361C16 4.3002 14.1499 2 12.25 2Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M12.25 6.5C12.6642 6.5 13 6.16421 13 5.75C13 5.33579 12.6642 5 12.25 5C11.8358 5 11.5 5.33579 11.5 5.75C11.5 6.16421 11.8358 6.5 12.25 6.5Z"
          fill={fill}
        />
        <path
          d="M12.25 7.5C13.2165 7.5 14 6.7165 14 5.75C14 4.7835 13.2165 4 12.25 4C11.2835 4 10.5 4.7835 10.5 5.75C10.5 6.7165 11.2835 7.5 12.25 7.5Z"
          fill={fill}
        />
      </g>
    </svg>
  );
}

export default Key;
