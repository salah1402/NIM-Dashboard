import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400 font-mono",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#F0EFEA] text-stone-700",
        secondary:
          "border-[#E5E3DE] bg-white text-stone-600",
        outline:
          "border-[#E5E3DE] text-stone-700 bg-transparent",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning:
          "border-amber-200 bg-amber-50 text-amber-700",
        danger:
          "border-rose-200 bg-rose-50 text-rose-700",
        emerald:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
        terracotta:
          "border-emerald-200 bg-emerald-50 text-emerald-700",
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
