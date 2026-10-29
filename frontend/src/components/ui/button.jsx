import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-[#191918] text-white hover:bg-black shadow-xs active:scale-[0.98]",
        primary:
          "bg-[#C96442] text-white hover:bg-[#B35536] shadow-xs active:scale-[0.98]",
        secondary:
          "bg-white text-[#191918] border border-[#E5E3DE] hover:bg-[#F0EFEA] hover:border-stone-400 shadow-xs active:scale-[0.98]",
        ghost:
          "text-stone-600 hover:text-[#191918] hover:bg-[#F0EFEA] active:scale-[0.98]",
        outline:
          "border border-[#E5E3DE] bg-transparent hover:bg-[#F0EFEA] text-[#191918]",
        subtle:
          "bg-[#F0EFEA] text-stone-700 hover:bg-[#E5E3DE] hover:text-[#191918]",
        destructive:
          "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-7 rounded-lg px-2.5 text-[11px]",
        lg: "h-10 rounded-xl px-4 text-sm",
        icon: "h-8 w-8 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
