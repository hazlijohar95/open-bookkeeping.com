import { IconProps } from "@/types";
import { cn } from "@/lib/utils";

function Truck({ fill = "currentColor", secondaryfill, className, ...props }: IconProps) {
  secondaryfill = secondaryfill || fill;

  return (
    <svg viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className={cn("size-[18px]", className)} {...props}>
      <g fill={fill}>
        <path
          d="M1 4.75C1 3.23079 2.23079 2 3.75 2H9.25C10.7692 2 12 3.23079 12 4.75V12.5H3.75C2.23079 12.5 1 11.2692 1 9.75V4.75Z"
          fill={secondaryfill}
          fillOpacity="0.4"
        />
        <path
          d="M12 6.5H14.1716C14.702 6.5 15.2107 6.71071 15.5858 7.08579L16.9142 8.41421C17.2893 8.78929 17.5 9.29799 17.5 9.82843V11.75C17.5 12.4404 16.9404 13 16.25 13H12V6.5Z"
          fill={fill}
        />
        <path
          d="M5 15.5C6.10457 15.5 7 14.6046 7 13.5C7 12.3954 6.10457 11.5 5 11.5C3.89543 11.5 3 12.3954 3 13.5C3 14.6046 3.89543 15.5 5 15.5Z"
          fill={fill}
        />
        <path
          d="M14.5 15.5C15.6046 15.5 16.5 14.6046 16.5 13.5C16.5 12.3954 15.6046 11.5 14.5 11.5C13.3954 11.5 12.5 12.3954 12.5 13.5C12.5 14.6046 13.3954 15.5 14.5 15.5Z"
          fill={fill}
        />
      </g>
    </svg>
  );
}

export default Truck;
