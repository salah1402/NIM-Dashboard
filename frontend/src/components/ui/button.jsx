import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-100 text-zinc-900 hover:bg-white shadow-xs active:scale-[0.98]",
        primary:
          "bg-[#C96442] text-white hover:bg-[#D97352] shadow-xs active:scale-[0.98]",
        secondary:
          "bg-zinc-800 text-zinc-200 border border-zinc-700/80 hover:bg-zinc-700/80 hover:text-white shadow-xs active:scale-[0.98]",
        ghost:
          "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 active:scale-[0.98]",
        outline:
          "border border-zinc-800 bg-transparent hover:bg-zinc-800/60 text-zinc-300 hover:text-white",
        subtle:
          "bg-zinc-800/70 text-zinc-300 hover:bg-zinc-700/70 hover:text-white",
        destructive:
          "bg-rose-950/60 text-rose-300 border border-rose-800/60 hover:bg-rose-900/60",
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
