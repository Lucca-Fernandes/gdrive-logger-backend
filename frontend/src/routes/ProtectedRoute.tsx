import { Navigate, Outlet } from 'react-router-dom';

const useAuth = () => {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  return isLoggedIn;
};

const ProtectedRoute = () => {
  const isAuth = useAuth();
  
  return isAuth ? <Outlet /> : <Navigate to="/" replace />;
};

export default ProtectedRoute;