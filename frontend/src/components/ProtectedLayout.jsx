import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const ProtectedLayout = ({ children, allowedRoles = [] }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    console.log('[ProtectedLayout] Check. Loading:', loading, 'User:', user?.email);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="spinner-border animate-spin inline-block w-8 h-8 border-4 border-safaricom-green border-t-transparent rounded-full" role="status"></div>
                    <p className="mt-4 text-gray-500 font-bold animate-pulse">Securely Authenticating...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        // console.log("No user found, redirecting to login...");
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Role Check
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        toast.error('Access Denied: Insufficient Permissions');
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedLayout;
