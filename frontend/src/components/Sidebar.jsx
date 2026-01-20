import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    FaHome, FaUsers, FaMoneyBillWave, FaChartBar, FaFileAlt,
    FaHandHoldingUsd, FaFileInvoiceDollar, FaUserTie,
    FaBalanceScale, FaCog, FaBell, FaUserCircle, FaCheckCircle, FaSms, FaChartLine, FaClipboardList
} from 'react-icons/fa';

const Sidebar = ({ isMobile, closeMobileMenu }) => {
    const navItems = [
        { path: '/', name: 'Dashboard', icon: <FaHome /> },
        { path: '/members', name: 'Members', icon: <FaUsers /> },
        { path: '/contributions', name: 'Contributions', icon: <FaFileInvoiceDollar /> },
        { path: '/contribution-compliance', name: 'Contribution Compliance', icon: <FaChartLine /> },
        { path: '/loans', name: 'Loans', icon: <FaHandHoldingUsd /> },
        { path: '/loan-approvals', name: 'Loan Approvals', icon: <FaCheckCircle /> },
        { path: '/loan-repayment-tracking', name: 'Loan Repayment Tracking', icon: <FaClipboardList /> },
        { path: '/dividends', name: 'Dividends', icon: <FaMoneyBillWave /> },
        { path: '/officers', name: 'Officers', icon: <FaUserTie /> },
        { path: '/reconciliation', name: 'Reconciliation', icon: <FaBalanceScale /> },
        { path: '/admin', name: 'Admin Panel', icon: <FaCog /> },
        { path: '/notifications', name: 'Notifications', icon: <FaBell /> },
        { path: '/profile', name: 'Profile', icon: <FaUserCircle /> },
        { path: '/daily-reports', name: 'Daily Cash Report', icon: <FaFileAlt /> },
        { path: '/meeting-sessions', name: 'Meeting Sessions', icon: <FaChartBar /> },
        { path: '/cash-reconciliation', name: 'Cash Reconciliation', icon: <FaBalanceScale /> },
        { path: '/sms-reports', name: 'SMS Reports', icon: <FaSms /> },
        { path: '/daily-meeting-report', name: 'Meeting Report', icon: <FaFileAlt /> },
        { path: '/group-monthly', name: 'Group Monthly', icon: <FaFileAlt /> },
    ];

    const handleClick = () => {
        if (isMobile && closeMobileMenu) {
            closeMobileMenu();
        }
    };

    return (
        <div className={`w-64 bg-safaricom-green text-white h-full overflow-y-auto z-30 transition-all`}>
            {!isMobile && (
                <div className="p-6 border-b border-safaricom-dark/30">
                    <h1 className="text-2xl font-bold tracking-tight">UKOMBOZI</h1>
                    <p className="text-safaricom-light text-[10px] font-bold uppercase tracking-widest mt-1">Table Banking System</p>
                </div>
            )}
            <nav className="mt-4 pb-10">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleClick}
                        className={({ isActive }) => `
                            flex items-center px-6 py-3.5 transition-all duration-200 group
                            ${isActive ? 'bg-safaricom-dark border-r-4 border-safaricom-light font-bold' : 'hover:bg-safaricom-dark/50'}
                        `}
                    >
                        <span className={`text-lg mr-4 transition-transform group-hover:scale-110`}>{item.icon}</span>
                        <span className="font-medium text-[13px] tracking-wide">{item.name}</span>
                    </NavLink>
                ))}
            </nav>
        </div>
    );
};

export default Sidebar;
