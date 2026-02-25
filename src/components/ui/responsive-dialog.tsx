import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialog({ open, onOpenChange, children, className }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn("max-h-[85dvh]", className)}>
          <div className="overflow-y-auto overscroll-contain px-4 pb-8 pt-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-lg max-h-[90vh] overflow-y-auto", className)}>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function ResponsiveDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerHeader className={cn("text-left px-0", className)} {...props} />;
  }
  return <DialogHeader className={className} {...props} />;
}

export function ResponsiveDialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerTitle className={className} {...props}>{children}</DrawerTitle>;
  }
  return <DialogTitle className={className} {...props}>{children}</DialogTitle>;
}

export function ResponsiveDialogDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return <DrawerDescription className={className} {...props}>{children}</DrawerDescription>;
  }
  return <DialogDescription className={className} {...props}>{children}</DialogDescription>;
}
