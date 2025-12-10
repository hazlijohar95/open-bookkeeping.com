import { IconProps } from "@/types";

function Sync({ fill = "currentColor", secondaryfill, ...props }: IconProps) {
  secondaryfill = secondaryfill || fill;

  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g fill={fill}>
        {/* Background circle */}
        <circle cx="9" cy="9" r="6" fill={secondaryfill} fillOpacity="0.4" />
        {/* Top arrow */}
        <path
          d="M9 2C5.13401 2 2 5.13401 2 9H0.5L3 12L5.5 9H4C4 6.23858 6.23858 4 9 4C10.1256 4 11.1643 4.37194 12 4.99963L13.4 3.59961C12.1934 2.59493 10.6683 2 9 2Z"
          fill={fill}
        />
        {/* Bottom arrow */}
        <path
          d="M9 16C12.866 16 16 12.866 16 9H17.5L15 6L12.5 9H14C14 11.7614 11.7614 14 9 14C7.87443 14 6.83566 13.6281 6 13.0004L4.6 14.4004C5.80659 15.4051 7.33172 16 9 16Z"
          fill={fill}
        />
      </g>
    </svg>
  );
}

export default Sync;
