import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 font-mono",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#191918] text-white",
        secondary:
          "border-[#E5E3DE] bg-[#F0EFEA] text-stone-700",
        outline:
          "border-[#E5E3DE] text-stone-700 bg-white",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-800",
        warning:
          "border-amber-200 bg-amber-50 text-amber-800",
        danger:
          "border-rose-200 bg-rose-50 text-rose-800",
        terracotta:
          "border-[#C96442]/30 bg-[#C96442]/10 text-[#C96442]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
