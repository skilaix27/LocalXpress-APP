import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import type { StopStatus } from "@/lib/supabase-types";
import { Package, CheckCircle, Truck } from "lucide-react";

interface StatusBadgeProps {
  status: StopStatus;
  className?: string;
}

const statusConfig: Record<StopStatus, { 
  label: string; 
  className: string;
  icon: typeof Package;
}> = {
  pending: {
    label: 'Pendiente',
    className: 'bg-muted text-muted-foreground',
    icon: Package,
  },
  picked: {
    label: 'Recogido',
    className: 'bg-status-picked-bg text-status-picked',
    icon: Truck,
  },
  delivered: {
    label: 'Entregado',
    className: 'bg-status-delivered-bg text-status-delivered',
    icon: CheckCircle,
  },
};

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, className }, ref) => {
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
          config.className,
          className
        )}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  }
);

StatusBadge.displayName = "StatusBadge";
