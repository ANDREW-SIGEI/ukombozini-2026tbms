import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import OfflineIndicator from './OfflineIndicator';
import { api } from '../services/api';

const ProtectedLayout = ({ children, allowedRoles = [] }) => {
    const { user, loading } = useAuth();
    const location = useLocation();
    const [health, setHealth] = useState('CHECKING');
    const [healthDetails, setHealthDetails] = useState(null);

    useEffect(() => {
        let interval;
        if (user) {
            const checkHealth = async () => {
                try {
                    const status = await api.getSystemHealth();
                    if (status.status === 'UP') {
                        setHealth('UP');
                        setHealthDetails(status);
                    } else {
                        setHealth('DOWN');
                        console.warn('System Health Issues:', status);
                    }
                } catch (e) {
                    setHealth('DOWN');
                }
            };

            checkHealth(); // Initial check
            interval = setInterval(checkHealth, 30000); // Check every 30s
        }
        return () => clearInterval(interval);
    }, [user]); const location = useLocation();

    // console.log('[ProtectedLayout] Check. Loading:', loading, 'User:', user?.email);

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

    return (
        <>
            {/* System Status Indicator (Only visible if issues or for admins) */}
            <div className="fixed top-0 right-0 m-4 z-50 flex gap-2">
                {health === 'DOWN' && (
                    <div className="bg-red-500 text-white text-xs px-2 py-1 rounded shadow animate-pulse" title="Backend connection lost">
                        ⚠️ SYSTEM OFFLINE
                    </div>
                )}
                {health === 'UP' && user.role === 'admin' && (
                    <div className="bg-green-500 text-white text-xs px-2 py-1 rounded shadow opacity-50 hover:opacity-100 transition-opacity cursor-help"
                        title={`DB: ${healthDetails?.services?.database} | SMS: ${healthDetails?.services?.sms_gateway}`}>
                        ● SYSTEM HEALTHY
                    </div>
                )}
            </div>

            <OfflineIndicator />
            {children}
        </>
    );
};

export default ProtectedLayout;
