import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect based on role
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  } else if (role === 'driver') {
    return <Navigate to="/driver" replace />;
  }

  // No role assigned - show pending message
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2">Cuenta pendiente</h2>
        <p className="text-muted-foreground mb-4">
          Tu cuenta está pendiente de asignación de rol. Un administrador te asignará como repartidor o admin pronto.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="text-primary hover:underline text-sm"
        >
          Refrescar página
        </button>
      </div>
    </div>
  );
}
