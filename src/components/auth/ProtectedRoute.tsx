import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'driver' | 'shop';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-[100dvh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    // Redirect to appropriate page based on role
    if (role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (role === 'driver') {
      return <Navigate to="/driver" replace />;
    } else if (role === 'shop') {
      return <Navigate to="/shop" replace />;
    } else {
      return <Navigate to="/auth" replace />;
    }
  }

  return <>{children}</>;
}
