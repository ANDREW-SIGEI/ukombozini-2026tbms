import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    FaHouse, FaUsers, FaMoneyBillWave, FaChartBar, FaFileLines,
    FaHandHoldingDollar, FaFileInvoiceDollar, FaUserTie,
    FaScaleBalanced, FaGear, FaBell, FaCircleUser, FaCircleCheck,
    FaCommentSms, FaChartLine, FaClipboardList, FaArrowRightFromBracket,
    FaCalculator, FaLayerGroup, FaShieldHalved
} from 'react-icons/fa6';

const Sidebar = ({ isMobile, closeMobileMenu }) => {
    const location = useLocation();
    const { user, logout } = useAuth();

    const sections = [
        {
            title: "Overview",
            items: [
                { path: '/', name: 'Dashboard', icon: <FaHouse /> },
            ]
        },
        {
            title: "Operations",
            items: [
                { path: '/members', name: 'Members', icon: <FaUsers /> },
                { path: '/groups', name: 'Groups', icon: <FaLayerGroup /> },
                { path: '/meeting-sessions', name: 'Meeting Sessions', icon: <FaChartBar /> },
                { path: '/daily-meeting-report', name: 'Meeting Reports', icon: <FaFileLines /> },
            ]
        },
        {
            title: "Financials",
            items: [
                { path: '/contributions', name: 'Contributions', icon: <FaFileInvoiceDollar /> },
                { path: '/loans', name: 'Loans Management', icon: <FaHandHoldingDollar /> },
                { path: '/loan-approvals', name: 'Approvals', icon: <FaCircleCheck /> },
                { path: '/dividends', name: 'Dividends', icon: <FaMoneyBillWave /> },
                { path: '/reconciliation', name: 'Reconciliation', icon: <FaScaleBalanced /> },
            ]
        },
        {
            title: "Analytics & Tools",
            items: [
                { path: '/loan-advisory', name: 'Loan Calculator', icon: <FaCalculator /> },
                { path: '/contribution-compliance', name: 'Compliance', icon: <FaChartLine /> },
                { path: '/loan-repayment-tracking', name: 'Repayment Track', icon: <FaClipboardList /> },
                { path: '/sms-reports', name: 'SMS Reports', icon: <FaCommentSms /> },
            ]
        },
        {
            title: "System",
            items: [
                { path: '/officers', name: 'Officers', icon: <FaUserTie /> },
                { path: '/admin', name: 'Admin Panel', icon: <FaShieldHalved /> },
                { path: '/notifications', name: 'Notifications', icon: <FaBell /> },
            ]
        }
    ];

    const handleClick = () => {
        if (isMobile && closeMobileMenu) {
            closeMobileMenu();
        }
    };

    return (
        <div className={`w-64 bg-safaricom-green text-white h-full overflow-y-auto z-30 transition-all flex flex-col scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent font-sans`}>
            {!isMobile && (
                <div className="p-6 pb-4 sticky top-0 bg-safaricom-green z-10 border-b border-white/10 backdrop-blur-sm">
                    {/* Brand Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                            UKOMBOZI
                        </h1>
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 pl-4">Table Banking System</p>
                    </div>

                    {/* User Profile Snippet */}
                    <NavLink to="/profile" className="flex items-center gap-3 p-3 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition-all group">
                        <div className="w-10 h-10 rounded-full bg-white text-safaricom-green flex items-center justify-center font-black text-sm border-2 border-white/30">
                            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate group-hover:text-white transition-colors">{user?.name || 'User'}</p>
                            <p className="text-[10px] text-white/60 truncate uppercase tracking-wider">{user?.role || 'Member'}</p>
                        </div>
                        <FaCircleUser className="text-white/40 group-hover:text-white transition-colors" />
                    </NavLink>
                </div>
            )}

            <nav className="flex-1 py-6 space-y-6">
                {sections.map((section, idx) => (
                    <div key={idx} className="px-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3 px-3">
                            {section.title}
                        </h3>
                        <div className="space-y-1">
                            {section.items.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={handleClick}
                                    className={({ isActive }) => `
                                        flex items-center px-4 py-3 rounded-xl transition-all duration-200 group
                                        ${isActive
                                            ? 'bg-white text-safaricom-green shadow-lg shadow-black/10 font-bold transform scale-[1.02]'
                                            : 'text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1'
                                        }
                                    `}
                                >
                                    <span className={`text-lg mr-3 transition-transform duration-300 ${location.pathname === item.path ? 'scale-110' : 'group-hover:scale-110'}`}>
                                        {item.icon}
                                    </span>
                                    <span className="text-sm font-medium tracking-wide">{item.name}</span>
                                    {location.pathname === item.path && (
                                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-safaricom-green"></div>
                                    )}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-white/10 bg-safaricom-green/50 backdrop-blur-md sticky bottom-0">
                <button
                    onClick={() => {
                        if (window.confirm("Are you sure you want to logout?")) {
                            logout();
                            window.location.href = '/login';
                        }
                    }}
                    className="flex items-center w-full px-4 py-3.5 transition-all duration-300 group hover:bg-red-500/20 bg-black/20 rounded-xl border border-transparent hover:border-red-500/30"
                >
                    <div className="p-2 bg-red-500/20 rounded-lg group-hover:bg-red-500 text-red-100 group-hover:text-white transition-colors">
                        <FaArrowRightFromBracket size={14} />
                    </div>
                    <div className="ml-3 text-left">
                        <span className="block text-xs font-black text-white/50 group-hover:text-red-200 uppercase tracking-wider">Session</span>
                        <span className="block font-bold text-sm text-white group-hover:text-white">Logout / Exit</span>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
