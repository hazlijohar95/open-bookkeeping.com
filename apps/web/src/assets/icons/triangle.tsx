import type { IconProps } from "@/types";

function Triangle({ fill = "currentColor", secondaryfill, ...props }: IconProps) {
  secondaryfill = secondaryfill ?? fill;

  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g fill={fill}>
        <path
          d="M9 2L16.5 15.5H1.5L9 2Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M9 1.25C9.35987 1.25 9.69416 1.43499 9.88574 1.73747L16.8857 13.0208C17.0948 13.3485 17.1068 13.7655 16.9171 14.1049C16.7275 14.4443 16.3687 14.6541 15.9792 14.6541H2.02083C1.63134 14.6541 1.27247 14.4443 1.08285 14.1049C0.893235 13.7655 0.905194 13.3485 1.11426 13.0208L8.11426 1.73747C8.30584 1.43499 8.64013 1.25 9 1.25ZM3.26619 13.1541H14.7338L9 4.04579L3.26619 13.1541Z"
          fill={fill}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

export default Triangle;
