import React, { useState, useEffect } from 'react';
import offlineManager from '../services/OfflineManager';
import { FaWifi, FaCloudUploadAlt, FaExclamationTriangle } from 'react-icons/fa';

const OfflineIndicator = () => {
    const [status, setStatus] = useState({ isOnline: navigator.onLine, pendingCount: 0 });

    useEffect(() => {
        const checkStatus = async () => {
            const pending = await offlineManager.getPendingTransactions();
            setStatus({
                isOnline: navigator.onLine,
                pendingCount: pending.length
            });
        };

        checkStatus();

        // Listen for events
        const handleOnline = () => setStatus(prev => ({ ...prev, isOnline: true }));
        const handleOffline = () => setStatus(prev => ({ ...prev, isOnline: false }));

        // Poll for pending count updates (simple way to keep in sync)
        const interval = setInterval(checkStatus, 5000);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    // Only show if offline OR pending items exist
    if (status.isOnline && status.pendingCount === 0) return null;

    return (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 transition-all transform hover:scale-105 border-2 ${!status.isOnline
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
            <div className={`p-2 rounded-full ${!status.isOnline ? 'bg-red-100' : 'bg-blue-100'}`}>
                {!status.isOnline ? (
                    <FaExclamationTriangle className="animate-pulse" />
                ) : (
                    <FaCloudUploadAlt className="animate-bounce" />
                )}
            </div>

            <div>
                <div className="text-xs font-black uppercase tracking-wider">
                    {!status.isOnline ? 'Offline Mode' : 'Syncing Data'}
                </div>
                <div className="text-[10px] font-bold opacity-80">
                    {status.pendingCount} transaction{status.pendingCount !== 1 ? 's' : ''} pending
                </div>
            </div>

            {status.isOnline && status.pendingCount > 0 && (
                <div className="ml-2 w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            )}
        </div>
    );
};

export default OfflineIndicator;
