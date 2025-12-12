import type { IconProps } from "@/types";

function LayoutSplit({ fill = "currentColor", secondaryfill, ...props }: IconProps) {
  secondaryfill = secondaryfill ?? fill;

  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g fill={fill}>
        {/* Left panel background */}
        <path
          d="M2.75 2.5C2.05964 2.5 1.5 3.05964 1.5 3.75V14.25C1.5 14.9404 2.05964 15.5 2.75 15.5H8.25V2.5H2.75Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        {/* Right panel background */}
        <path
          d="M9.75 2.5V15.5H15.25C15.9404 15.5 16.5 14.9404 16.5 14.25V3.75C16.5 3.05964 15.9404 2.5 15.25 2.5H9.75Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        {/* Border outline */}
        <path
          d="M2.75 1C1.23122 1 0 2.23122 0 3.75V14.25C0 15.7688 1.23122 17 2.75 17H15.25C16.7688 17 18 15.7688 18 14.25V3.75C18 2.23122 16.7688 1 15.25 1H2.75ZM1.5 3.75C1.5 3.05964 2.05964 2.5 2.75 2.5H8.25V15.5H2.75C2.05964 15.5 1.5 14.9404 1.5 14.25V3.75ZM9.75 15.5V2.5H15.25C15.9404 2.5 16.5 3.05964 16.5 3.75V14.25C16.5 14.9404 15.9404 15.5 15.25 15.5H9.75Z"
          fill={fill}
          fillRule="evenodd"
        />
        {/* Left panel lines (representing form) */}
        <path
          d="M3 5.25C3 4.83579 3.33579 4.5 3.75 4.5H6.25C6.66421 4.5 7 4.83579 7 5.25C7 5.66421 6.66421 6 6.25 6H3.75C3.33579 6 3 5.66421 3 5.25Z"
          fill={fill}
        />
        <path
          d="M3 8.25C3 7.83579 3.33579 7.5 3.75 7.5H6.25C6.66421 7.5 7 7.83579 7 8.25C7 8.66421 6.66421 9 6.25 9H3.75C3.33579 9 3 8.66421 3 8.25Z"
          fill={fill}
        />
        {/* Right panel (representing preview - document shape) */}
        <path
          d="M11 5.5C11 5.22386 11.2239 5 11.5 5H14.5C14.7761 5 15 5.22386 15 5.5V12.5C15 12.7761 14.7761 13 14.5 13H11.5C11.2239 13 11 12.7761 11 12.5V5.5Z"
          fill={fill}
          fillOpacity="0.6"
        />
      </g>
    </svg>
  );
}

export default LayoutSplit;
