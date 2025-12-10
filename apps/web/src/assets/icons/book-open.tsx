import { IconProps } from "@/types";

function BookOpen({ fill = "currentColor", secondaryfill, ...props }: IconProps) {
  secondaryfill = secondaryfill || fill;

  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g fill={fill}>
        <path
          d="M9 4.5V15.5C7.5 14.5 5.5 14 3.75 14C2.7835 14 1.5 14.25 1.5 14.25V3.25C1.5 3.25 2.7835 3 3.75 3C5.5 3 7.5 3.5 9 4.5Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M9 4.5V15.5C10.5 14.5 12.5 14 14.25 14C15.2165 14 16.5 14.25 16.5 14.25V3.25C16.5 3.25 15.2165 3 14.25 3C12.5 3 10.5 3.5 9 4.5Z"
          fill={fill}
        />
      </g>
    </svg>
  );
}

export default BookOpen;
