import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from '../pages/Dashboard'; 
import LoginPage from '../pages/LoginPage'; 
import ProtectedRoute from './ProtectedRoute'; 

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}