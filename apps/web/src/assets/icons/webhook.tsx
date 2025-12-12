import type { IconProps } from "@/types";
import { cn } from "@/lib/utils";

function Webhook({ fill = "currentColor", secondaryfill, className, ...props }: IconProps) {
  secondaryfill = secondaryfill ?? fill;

  return (
    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={cn("size-[18px]", className)} {...props}>
      <g fill={fill}>
        <circle cx="4.5" cy="12.5" r="2.5" fill={secondaryfill} fillOpacity="0.4" />
        <circle cx="13.5" cy="12.5" r="2.5" fill={secondaryfill} fillOpacity="0.4" />
        <circle cx="9" cy="4.5" r="2.5" fill={secondaryfill} fillOpacity="0.4" />
        <path
          d="M9 6C9.41421 6 9.75 6.33579 9.75 6.75V10.25C9.75 10.6642 9.41421 11 9 11C8.58579 11 8.25 10.6642 8.25 10.25V6.75C8.25 6.33579 8.58579 6 9 6Z"
          fill={fill}
        />
        <path
          d="M5.54289 11.0429C5.84171 10.7441 6.32284 10.7441 6.62166 11.0429L8.46967 12.8909C8.76256 13.1838 8.76256 13.6587 8.46967 13.9516C8.17678 14.2445 7.7019 14.2445 7.40901 13.9516L5.56099 12.1036C5.26217 11.8048 5.26217 11.3236 5.56099 11.0248L5.54289 11.0429Z"
          fill={fill}
        />
        <path
          d="M12.4571 11.0429C12.1583 10.7441 11.6772 10.7441 11.3783 11.0429L9.53033 12.8909C9.23744 13.1838 9.23744 13.6587 9.53033 13.9516C9.82322 14.2445 10.2981 14.2445 10.591 13.9516L12.439 12.1036C12.7378 11.8048 12.7378 11.3236 12.439 11.0248L12.4571 11.0429Z"
          fill={fill}
        />
      </g>
    </svg>
  );
}

export default Webhook;
