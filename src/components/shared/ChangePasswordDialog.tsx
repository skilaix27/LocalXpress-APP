import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog, ResponsiveDialogHeader, ResponsiveDialogTitle, ResponsiveDialogDescription,
} from '@/components/ui/responsive-dialog';
import { Lock, Mail } from 'lucide-react';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Cambiar contraseña
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          El cambio de contraseña debe realizarse a través del administrador
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Mail className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-xs">
          Para cambiar tu contraseña, contacta con el administrador de LocalXpress.
        </p>
      </div>
      <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
        Cerrar
      </Button>
    </ResponsiveDialog>
  );
}
