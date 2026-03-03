import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { User, Lock } from 'lucide-react';
import logoLocalxpress from '@/assets/logo-localxpress.png';

export default function Auth() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let email = identifier.trim();

    // Input length validation
    if (email.length > 254 || password.length > 128) {
      toast.error('Datos inválidos');
      setLoading(false);
      return;
    }

    // If no "@", look up email by name
    if (!email.includes('@')) {
      try {
        const { data, error } = await supabase.functions.invoke('lookup-email', {
          body: { username: email },
        });
        if (error || data?.error) {
          toast.error('Usuario no encontrado', {
            description: 'Verifica tu nombre de usuario o usa tu email.',
          });
          setLoading(false);
          return;
        }
        email = data.email;
      } catch {
        toast.error('Error al buscar usuario');
        setLoading(false);
        return;
      }
    }

    const { error } = await signIn(email, password);

    if (error) {
      toast.error('Error al iniciar sesión', {
        description: 'Email/usuario o contraseña incorrectos.',
      });
    } else {
      toast.success('¡Bienvenido!');
      navigate('/');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] bg-muted/50 flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <motion.img
            src={logoLocalxpress}
            alt="LocalXpress"
            className="h-16 mx-auto mb-3"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          />
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Portal LocalXpress</span>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-card rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-bold text-center text-foreground mb-6">Iniciar sesión</h2>
          
          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Usuario o email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full h-12 pl-12 pr-4 rounded-full border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-12 pl-12 pr-4 rounded-full border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 rounded-full text-base font-semibold"
              disabled={loading}
            >
              {loading ? 'Cargando...' : 'Entrar'}
            </Button>
          </form>
          
          <p className="text-center text-primary text-sm mt-5 cursor-pointer hover:underline">
            Contacta con tu administrador si no tienes acceso
          </p>
        </div>

        {/* Legal notice */}
        <p className="text-center text-muted-foreground/70 text-xs mt-6 max-w-sm mx-auto leading-relaxed">
          Los datos personales recogidos se utilizarán exclusivamente con fines profesionales de gestión de repartos, conforme al RGPD. No se cederán a terceros.
        </p>
      </motion.div>
    </div>
  );
}
