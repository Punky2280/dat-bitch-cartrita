import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute: React.FC = () => {
  const { token } = useAuth(); 

  if (!token) {
    // user is not authenticated
    return <Navigate to="/login" />;
  }
  return <Outlet />;
};

export default ProtectedRoute;