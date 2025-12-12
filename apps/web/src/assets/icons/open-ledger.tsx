import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  secondaryfill?: string;
  strokewidth?: number;
  title?: string;
};

/**
 * Open Ledger Icon - Brand icon for Open-Bookkeeping
 * A stylized open ledger with visible spine and entry rows
 */
function OpenLedger({ fill = "currentColor", secondaryfill, ...props }: IconProps) {
  secondaryfill = secondaryfill ?? fill;

  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g fill={fill}>
        {/* Left page with subtle curve */}
        <path
          d="M8.5 3C7 2.2 5 2 3.5 2C2.5 2 1.5 2.2 1.5 2.2V14C1.5 14 2.5 13.8 3.5 13.8C5 13.8 7 14 8.5 14.8V3Z"
          fill={secondaryfill}
          fillOpacity="0.3"
        />
        {/* Right page - main */}
        <path
          d="M9.5 3C11 2.2 13 2 14.5 2C15.5 2 16.5 2.2 16.5 2.2V14C16.5 14 15.5 13.8 14.5 13.8C13 13.8 11 14 9.5 14.8V3Z"
          fill={fill}
        />
        {/* Center spine */}
        <rect
          x="8.25"
          y="2"
          width="1.5"
          height="13.5"
          rx="0.75"
          fill={fill}
          fillOpacity="0.6"
        />
        {/* Ledger entry lines on right page */}
        <line x1="11" y1="5.5" x2="15" y2="5.5" stroke="white" strokeWidth="1" strokeOpacity="0.7" strokeLinecap="round" />
        <line x1="11" y1="8" x2="15" y2="8" stroke="white" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />
        <line x1="11" y1="10.5" x2="14" y2="10.5" stroke="white" strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default OpenLedger;
