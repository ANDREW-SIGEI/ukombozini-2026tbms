import React, { useState, useEffect } from 'react';
import { FaComment, FaEnvelope, FaBell, FaCheckCircle, FaExclamationCircle, FaRedo, FaSms } from 'react-icons/fa';
import NotificationService from '../services/NotificationService';
// Internal time utility used instead

const NotificationsPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL'); // ALL, SMS, EMAIL

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        const data = await NotificationService.getLogs(100);
        setLogs(data);
        setLoading(false);
    };

    const handleResend = async (notification) => {
        // Logic to resend (just calls the service again)
        if (notification.type === 'SMS') {
            await NotificationService.sendSMS(notification.recipient, notification.body, notification.metadata);
        } else {
            await NotificationService.sendEmail(notification.recipient, notification.title, notification.body, notification.metadata);
        }
        await fetchLogs(); // Refresh
    };

    const filteredLogs = logs.filter(log => filter === 'ALL' || log.type === filter);

    const getIcon = (type) => {
        if (type === 'SMS') return <FaSms className="text-blue-500" />;
        if (type === 'EMAIL') return <FaEnvelope className="text-orange-500" />;
        return <FaBell className="text-gray-500" />;
    };

    // Simple time formatter if utility is missing
    const timeAgo = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-gray-800 tracking-tight">System Notifications</h2>
                    <p className="text-sm text-gray-500 font-medium">Log of all SMS and Email communications sent to members.</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                >
                    <FaRedo className={`${loading ? 'animate-spin' : ''} text-gray-600`} />
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {['ALL', 'SMS', 'EMAIL'].map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-full text-xs font-black transition-all ${filter === f ? 'bg-safaricom-green text-white shadow-md' : 'bg-white text-gray-500 border border-gray-200'
                            }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Logs List */}
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
                {loading ? (
                    <div className="p-10 text-center text-gray-400">Loading logs...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-10 text-center text-gray-400">No notifications found.</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredLogs.map(log => (
                            <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors flex gap-4">
                                <div className="p-3 bg-gray-50 rounded-2xl h-fit">
                                    {getIcon(log.type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-gray-800 uppercase tracking-wider">{log.type}</span>
                                            <span className="text-xs text-gray-400">• {log.recipient}</span>
                                        </div>
                                        <span className="text-[10px] text-gray-400 font-mono">{timeAgo(log.created_at)}</span>
                                    </div>

                                    {log.title && (
                                        <h4 className="text-sm font-bold text-gray-900 mb-1">{log.title}</h4>
                                    )}
                                    <p className="text-sm text-gray-600 leading-relaxed font-medium bg-gray-50 p-3 rounded-tr-2xl rounded-bl-2xl rounded-br-2xl">
                                        {log.body}
                                    </p>

                                    <div className="mt-2 flex items-center justify-between">
                                        <span className={`text-[10px] flex items-center gap-1 font-bold ${log.status === 'SENT' ? 'text-green-600' : 'text-red-500'
                                            }`}>
                                            {log.status === 'SENT' ? <FaCheckCircle /> : <FaExclamationCircle />}
                                            {log.status}
                                        </span>
                                        {log.status === 'FAILED' && (
                                            <button
                                                onClick={() => handleResend(log)}
                                                className="text-[10px] text-blue-600 font-bold hover:underline"
                                            >
                                                Resend
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;
