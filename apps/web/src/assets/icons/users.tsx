import { IconProps } from "@/types";

function Users({ fill = "currentColor", secondaryfill, ...props }: IconProps) {
  secondaryfill = secondaryfill || fill;

  return (
    <svg height="18" width="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g fill={fill}>
        <path
          d="M6.5 8C8.15685 8 9.5 6.65685 9.5 5C9.5 3.34315 8.15685 2 6.5 2C4.84315 2 3.5 3.34315 3.5 5C3.5 6.65685 4.84315 8 6.5 8Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M6.5 9.5C3.46243 9.5 1 11.9624 1 15V15.25C1 15.6642 1.33579 16 1.75 16H11.25C11.6642 16 12 15.6642 12 15.25V15C12 11.9624 9.53757 9.5 6.5 9.5Z"
          fill={fill}
        />
        <path
          d="M11.5 8C13.1569 8 14.5 6.65685 14.5 5C14.5 3.34315 13.1569 2 11.5 2C10.8372 2 10.2233 2.19897 9.71191 2.53857C10.2043 3.22498 10.5 4.07867 10.5 5C10.5 5.92133 10.2043 6.77502 9.71191 7.46143C10.2233 7.80103 10.8372 8 11.5 8Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M13 15.25V15C13 13.4379 12.4716 11.9957 11.5822 10.8418C11.8853 10.7882 12.1948 10.75 12.5 10.75C14.8472 10.75 16.75 12.6528 16.75 15V15.25C16.75 15.6642 16.4142 16 16 16H12.9646C12.9879 15.7546 13 15.5038 13 15.25Z"
          fill={fill}
        />
      </g>
    </svg>
  );
}

export default Users;
