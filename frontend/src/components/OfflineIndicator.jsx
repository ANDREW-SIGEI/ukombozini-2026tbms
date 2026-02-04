import React, { useState, useEffect } from 'react';
import { FaWifi, FaCloudArrowUp, FaTriangleExclamation, FaCircleCheck } from 'react-icons/fa6';
import offlineManager from '../services/OfflineManager';

const OfflineIndicator = () => {
    const [status, setStatus] = useState({
        isOnline: navigator.onLine,
        pendingCount: 0,
        isSyncing: false
    });

    useEffect(() => {
        const updateStatus = async () => {
            const syncStatus = await offlineManager.getSyncStatus();
            setStatus(prev => ({
                ...prev,
                isOnline: navigator.onLine,
                pendingCount: syncStatus.pendingCount
            }));
        };

        // Initial check
        updateStatus();

        // Listen for online/offline events
        const handleStatusChange = () => {
            setStatus(prev => ({ ...prev, isOnline: navigator.onLine }));
            if (navigator.onLine) {
                // Trigger sync check when back online
                updateStatus();
            }
        };

        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);

        // Listen for sync notifications from OfflineManager
        const handleNotification = (e) => {
            const { message } = e.detail;
            if (message.includes('Syncing')) {
                setStatus(prev => ({ ...prev, isSyncing: true }));
            } else if (message.includes('Synced') || message.includes('failed')) {
                setStatus(prev => ({ ...prev, isSyncing: false }));
                updateStatus();
            }
        };

        window.addEventListener('offline-notification', handleNotification);

        // Periodic check for pending count
        const interval = setInterval(updateStatus, 10000);

        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
            window.removeEventListener('offline-notification', handleNotification);
            clearInterval(interval);
        };
    }, []);

    // Don't show anything if online and no pending syncs
    if (status.isOnline && status.pendingCount === 0 && !status.isSyncing) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 animate-in slide-in-from-bottom-10 duration-500">
            {/* Sync Progress Toast */}
            {status.isSyncing && (
                <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700">
                    <FaCloudArrowUp className="text-blue-400 animate-bounce" />
                    <div className="text-[11px] font-black uppercase tracking-widest">
                        Synchronizing Vault...
                    </div>
                </div>
            )}

            {/* Main Status Badge */}
            <div className={`
                flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border transition-all duration-300
                ${status.isOnline
                    ? 'bg-white border-slate-200 text-slate-800'
                    : 'bg-amber-500 border-amber-600 text-white'
                }
            `}>
                <div className="relative">
                    <FaWifi className={`${status.isOnline ? 'text-green-500' : 'text-white'} text-lg`} />
                    {!status.isOnline && (
                        <div className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5">
                            <FaTriangleExclamation className="text-[8px]" />
                        </div>
                    )}
                </div>

                <div className="flex flex-col">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-none mb-1">
                        Network Status
                    </div>
                    <div className="text-xs font-black flex items-center gap-2">
                        {status.isOnline ? 'INSTITUTIONAL ONLINE' : 'OFFLINE MODE'}
                    </div>
                </div>

                {status.pendingCount > 0 && (
                    <div className={`
                        ml-2 px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-2
                        ${status.isOnline ? 'bg-amber-100 text-amber-600' : 'bg-white/20 text-white'}
                    `}>
                        <FaCloudArrowUp className={status.isOnline ? 'animate-bounce' : ''} />
                        {status.pendingCount} PENDING SYNC
                    </div>
                )}
            </div>

            {!status.isOnline && (
                <p className="mr-2 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white/80 px-2 py-1 rounded">
                    Field operations active • Local storage engaged
                </p>
            )}
        </div>
    );
};

export default OfflineIndicator;
