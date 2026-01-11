import React, { useState } from 'react';
import {
    FaUserShield, FaCog, FaDollarSign, FaFileAlt, FaHistory,
    FaDatabase, FaSave, FaEdit, FaCheckCircle, FaTimes, FaExclamationTriangle,
    FaLock, FaUnlock, FaTrash, FaUserPlus, FaShieldAlt, FaCalculator,
    FaClock, FaBan, FaCheck, FaTimesCircle, FaHandHoldingUsd, FaPiggyBank, FaUsers
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { checkPermission, PERMISSIONS } from '../utils/permissions';
import { validateSOP } from '../utils/sopMapping';

// Mock Data - In production, this would come from API/Context
const mockRoles = ['Director', 'Admin', 'Supervisor', 'Field Officer'];
const mockUsers = [
    { id: 1, name: 'Hilda Sigei', role: 'Director', email: 'hilda@ukombozi.com', status: 'Active' },
    { id: 2, name: 'David Omari', role: 'Admin', email: 'david@ukombozi.com', status: 'Active' },
    { id: 3, name: 'Sarah Wanjiku', role: 'Supervisor', email: 'sarah@ukombozi.com', status: 'Active' },
    { id: 4, name: 'Mary Atieno', role: 'Field Officer', email: 'mary@ukombozi.com', status: 'Active' },
];

const permissionMatrix = {
    'Create users': { Director: true, Admin: true, Supervisor: false, 'Field Officer': false },
    'Approve loans': { Director: true, Admin: true, Supervisor: true, 'Field Officer': false },
    'Post contributions': { Director: false, Admin: false, Supervisor: false, 'Field Officer': true },
    'Reverse transactions': { Director: true, Admin: true, Supervisor: false, 'Field Officer': false },
    'View audit logs': { Director: true, Admin: true, Supervisor: false, 'Field Officer': false },
    'Edit system rules': { Director: true, Admin: true, Supervisor: false, 'Field Officer': false },
    'Unlock reports': { Director: true, Admin: true, Supervisor: false, 'Field Officer': false },
    'Approve reports': { Director: true, Admin: true, Supervisor: true, 'Field Officer': false },
    'Export data': { Director: true, Admin: true, Supervisor: true, 'Field Officer': false },
    'Backup/Restore': { Director: true, Admin: false, Supervisor: false, 'Field Officer': false },
};

const mockAuditLogs = [
    { id: 1, user: 'Hilda Sigei', role: 'Director', action: 'Loan Approved', details: 'L-001 → Approved', timestamp: '2026-01-15 10:30:00', ip: '192.168.1.100' },
    { id: 2, user: 'David Omari', role: 'Admin', action: 'Rule Changed', details: 'Max Loan Multiplier: 2x → 3x', timestamp: '2026-01-15 09:15:00', ip: '192.168.1.101' },
    { id: 3, user: 'Sarah Wanjiku', role: 'Supervisor', action: 'Report Approved', details: 'Daily Report #2026-01-14', timestamp: '2026-01-14 18:00:00', ip: '192.168.1.102' },
    { id: 4, user: 'Hilda Sigei', role: 'Director', action: 'User Created', details: 'New Field Officer: John Doe', timestamp: '2026-01-13 14:20:00', ip: '192.168.1.100' },
    { id: 5, user: 'David Omari', role: 'Admin', action: 'Transaction Reversed', details: 'TRX-101 → Reversed', timestamp: '2026-01-12 11:45:00', ip: '192.168.1.101' },
];

const AdminPanel = () => {
    const { user, hasPermission, canEdit, isDirector } = useAuth();
    const [activeTab, setActiveTab] = useState('roles');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [pendingAction, setPendingAction] = useState(null);

    // System Rules State
    const [systemRules, setSystemRules] = useState({
        contribution: {
            minAmount: 500,
            maxMissedMeetings: 3,
            autoPenalty: true,
            penaltyAmount: 100,
        },
        loan: {
            maxLoanMultiplier: 3,
            interestRate: 10,
            gracePeriod: 7,
            penaltyPerDay: 50,
            minLoanAmount: 1000,
            maxLoanAmount: 500000,
        },
        group: {
            maxMembers: 30,
            groupLoanCeiling: 2000000,
            suspensionThreshold: 5,
        },
    });

    // Financial Settings State
    const [financialSettings, setFinancialSettings] = useState({
        currency: 'KES',
        interestMethod: 'simple',
        dividendFormula: 'proportional',
        roundingMethod: 'nearest',
        financialYearStart: '01-01',
        financialYearEnd: '12-31',
    });

    // Daily Report Rules State
    const [reportRules, setReportRules] = useState({
        blockNextDayAccess: true,
        blockLoanIfUnbalanced: true,
        autoLockAfterSubmission: true,
        requireVarianceExplanation: true,
        adminOnlyUnlock: true,
    });

    // Backup State
    const [backupStatus, setBackupStatus] = useState({
        lastBackup: '2026-01-15 02:00:00',
        status: 'OK',
        nextScheduled: '2026-01-16 02:00:00',
    });

    const handleSave = (section) => {
        // Check permission before allowing save
        const permissionCheck = checkPermission(user, PERMISSIONS.EDIT_SYSTEM_RULES, `save ${section}`);
        if (!permissionCheck.allowed) {
            toast.error(permissionCheck.reason || 'You do not have permission to save settings.');
            return;
        }

        // Validate SOP
        const sopCheck = validateSOP(user, PERMISSIONS.EDIT_SYSTEM_RULES);
        if (!sopCheck.allowed) {
            toast.error(sopCheck.reason || 'This action is not allowed for your role.');
            return;
        }

        setPendingAction({ type: 'save', section });
        setShowConfirmModal(true);
    };

    const confirmAction = () => {
        if (pendingAction) {
            toast.success(`${pendingAction.section} settings saved successfully!`);
            // In production, make API call here
        }
        setShowConfirmModal(false);
        setPendingAction(null);
    };

    const handleRuleChange = (category, field, value) => {
        setSystemRules(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: value,
            },
        }));
    };

    const handleFinancialChange = (field, value) => {
        setFinancialSettings(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleReportRuleToggle = (field) => {
        setReportRules(prev => ({
            ...prev,
            [field]: !prev[field],
        }));
    };

    const handleBackup = () => {
        setPendingAction({ type: 'backup' });
        setShowConfirmModal(true);
    };

    const tabs = [
        { id: 'roles', name: 'Roles & Permissions', icon: <FaUserShield /> },
        { id: 'rules', name: 'System Rules', icon: <FaCog /> },
        { id: 'financial', name: 'Financial Settings', icon: <FaDollarSign /> },
        { id: 'reports', name: 'Report Rules', icon: <FaFileAlt /> },
        { id: 'audit', name: 'Audit & Logs', icon: <FaHistory /> },
        { id: 'backup', name: 'Backup & Data', icon: <FaDatabase /> },
    ];

    // Use canEdit from auth context

    return (
        <div className="space-y-6 pb-10">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                        <FaShieldAlt className="mr-3 text-safaricom-green" />
                        Admin Panel
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">System configuration and control center</p>
                </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Current Role:</span>
                        <span className="px-3 py-1 bg-safaricom-green text-white rounded-lg text-xs font-bold">
                            {user?.role || 'Unknown'}
                        </span>
                    </div>
            </div>

            {/* Warning Banner for Non-Admin */}
            {!canEdit && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                    <div className="flex items-center">
                        <FaExclamationTriangle className="text-yellow-600 mr-2" />
                        <p className="text-sm font-bold text-yellow-800">
                            You have read-only access. Only Directors and Admins can modify settings.
                        </p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex border-b border-gray-100 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-bold text-sm transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-safaricom-green text-white border-b-2 border-white'
                                    : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.name}</span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {/* Roles & Permissions Tab */}
                    {activeTab === 'roles' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">User Roles & Permissions</h3>
                                {hasPermission(PERMISSIONS.CREATE_USER) && (
                                    <button 
                                        onClick={() => {
                                            const check = checkPermission(user, PERMISSIONS.CREATE_USER, 'create user');
                                            if (!check.allowed) {
                                                toast.error(check.reason);
                                                return;
                                            }
                                            toast.info('Add User functionality - to be implemented');
                                        }}
                                        className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-lg hover:bg-safaricom-dark transition-colors"
                                    >
                                        <FaUserPlus /> Add User
                                    </button>
                                )}
                            </div>

                            {/* Permission Matrix */}
                            <div className="bg-gray-50 rounded-xl p-6">
                                <h4 className="font-bold text-gray-800 mb-4">Permission Matrix</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-gray-200">
                                                <th className="text-left py-3 px-4 font-bold text-gray-700">Action</th>
                                                {mockRoles.map(role => (
                                                    <th key={role} className="text-center py-3 px-4 font-bold text-gray-700">
                                                        {role}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(permissionMatrix).map(([action, permissions]) => (
                                                <tr key={action} className="border-b border-gray-100 hover:bg-white">
                                                    <td className="py-3 px-4 font-medium text-gray-800">{action}</td>
                                                    {mockRoles.map(role => (
                                                        <td key={role} className="text-center py-3 px-4">
                                                            {permissions[role] ? (
                                                                <FaCheckCircle className="text-green-500 mx-auto" />
                                                            ) : (
                                                                <FaTimesCircle className="text-red-400 mx-auto" />
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Users List */}
                            <div>
                                <h4 className="font-bold text-gray-800 mb-4">System Users</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {mockUsers.map(user => (
                                        <div key={user.id} className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-gray-800">{user.name}</p>
                                                <p className="text-xs text-gray-500">{user.email}</p>
                                                <span className={`inline-block mt-2 px-2 py-1 rounded text-[10px] font-bold ${
                                                    user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {user.status}
                                                </span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xs font-bold text-safaricom-dark bg-safaricom-green/10 px-2 py-1 rounded">
                                                    {user.role}
                                                </span>
                                                {canEdit && (
                                                    <button className="mt-2 text-xs text-safaricom-green hover:underline">
                                                        Edit
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* System Rules Tab */}
                    {activeTab === 'rules' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">System Rules</h3>
                                {canEdit && (
                                    <button
                                        onClick={() => handleSave('System Rules')}
                                        className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-lg hover:bg-safaricom-dark transition-colors"
                                    >
                                        <FaSave /> Save Changes
                                    </button>
                                )}
                            </div>

                            {/* Contribution Rules */}
                            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                                <h4 className="font-bold text-gray-800 flex items-center">
                                    <FaPiggyBank className="mr-2 text-safaricom-green" />
                                    Contribution Rules
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Minimum Contribution Amount (KES)
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.contribution.minAmount}
                                            onChange={(e) => handleRuleChange('contribution', 'minAmount', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Max Missed Meetings Allowed
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.contribution.maxMissedMeetings}
                                            onChange={(e) => handleRuleChange('contribution', 'maxMissedMeetings', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={systemRules.contribution.autoPenalty}
                                            onChange={(e) => handleRuleChange('contribution', 'autoPenalty', e.target.checked)}
                                            disabled={!canEdit}
                                            className="w-5 h-5 text-safaricom-green focus:ring-safaricom-green"
                                        />
                                        <label className="text-sm font-bold text-gray-700">Auto-penalty for late contribution</label>
                                    </div>
                                    {systemRules.contribution.autoPenalty && (
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">
                                                Penalty Amount (KES)
                                            </label>
                                            <input
                                                type="number"
                                                value={systemRules.contribution.penaltyAmount}
                                                onChange={(e) => handleRuleChange('contribution', 'penaltyAmount', parseInt(e.target.value))}
                                                disabled={!canEdit}
                                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Loan Rules */}
                            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                                <h4 className="font-bold text-gray-800 flex items-center">
                                    <FaHandHoldingUsd className="mr-2 text-safaricom-green" />
                                    Loan Rules
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Max Loan Multiplier (× Savings)
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.loan.maxLoanMultiplier}
                                            onChange={(e) => handleRuleChange('loan', 'maxLoanMultiplier', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">e.g., 3x means member can borrow up to 3× their total savings</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Interest Rate (%)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={systemRules.loan.interestRate}
                                            onChange={(e) => handleRuleChange('loan', 'interestRate', parseFloat(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Grace Period (Days)
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.loan.gracePeriod}
                                            onChange={(e) => handleRuleChange('loan', 'gracePeriod', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Penalty Per Late Day (KES)
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.loan.penaltyPerDay}
                                            onChange={(e) => handleRuleChange('loan', 'penaltyPerDay', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Minimum Loan Amount (KES)
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.loan.minLoanAmount}
                                            onChange={(e) => handleRuleChange('loan', 'minLoanAmount', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Maximum Loan Amount (KES)
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.loan.maxLoanAmount}
                                            onChange={(e) => handleRuleChange('loan', 'maxLoanAmount', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Group Rules */}
                            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                                <h4 className="font-bold text-gray-800 flex items-center">
                                    <FaUsers className="mr-2 text-safaricom-green" />
                                    Group Rules
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Max Members Per Group
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.group.maxMembers}
                                            onChange={(e) => handleRuleChange('group', 'maxMembers', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Group Loan Ceiling (KES)
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.group.groupLoanCeiling}
                                            onChange={(e) => handleRuleChange('group', 'groupLoanCeiling', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Suspension Threshold (Missed Meetings)
                                        </label>
                                        <input
                                            type="number"
                                            value={systemRules.group.suspensionThreshold}
                                            onChange={(e) => handleRuleChange('group', 'suspensionThreshold', parseInt(e.target.value))}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Group will be suspended after this many missed meetings</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Financial Settings Tab */}
                    {activeTab === 'financial' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">Financial Settings</h3>
                                {canEdit && (
                                    <button
                                        onClick={() => handleSave('Financial Settings')}
                                        className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-lg hover:bg-safaricom-dark transition-colors"
                                    >
                                        <FaSave /> Save Changes
                                    </button>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-xl p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Currency
                                        </label>
                                        <select
                                            value={financialSettings.currency}
                                            onChange={(e) => handleFinancialChange('currency', e.target.value)}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        >
                                            <option value="KES">KES (Kenyan Shilling)</option>
                                            <option value="USD">USD (US Dollar)</option>
                                            <option value="UGX">UGX (Ugandan Shilling)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Interest Calculation Method
                                        </label>
                                        <select
                                            value={financialSettings.interestMethod}
                                            onChange={(e) => handleFinancialChange('interestMethod', e.target.value)}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        >
                                            <option value="simple">Simple Interest</option>
                                            <option value="compound">Compound Interest</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Dividend Calculation Formula
                                        </label>
                                        <select
                                            value={financialSettings.dividendFormula}
                                            onChange={(e) => handleFinancialChange('dividendFormula', e.target.value)}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        >
                                            <option value="proportional">Proportional (Member Contribution / Total Contributions × Net Profit)</option>
                                            <option value="equal">Equal Share</option>
                                            <option value="weighted">Weighted by Contribution Period</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Rounding Method
                                        </label>
                                        <select
                                            value={financialSettings.roundingMethod}
                                            onChange={(e) => handleFinancialChange('roundingMethod', e.target.value)}
                                            disabled={!canEdit}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        >
                                            <option value="nearest">Round to Nearest</option>
                                            <option value="up">Round Up</option>
                                            <option value="down">Round Down</option>
                                            <option value="none">No Rounding</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Financial Year Start (MM-DD)
                                        </label>
                                        <input
                                            type="text"
                                            value={financialSettings.financialYearStart}
                                            onChange={(e) => handleFinancialChange('financialYearStart', e.target.value)}
                                            disabled={!canEdit}
                                            placeholder="01-01"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Financial Year End (MM-DD)
                                        </label>
                                        <input
                                            type="text"
                                            value={financialSettings.financialYearEnd}
                                            onChange={(e) => handleFinancialChange('financialYearEnd', e.target.value)}
                                            disabled={!canEdit}
                                            placeholder="12-31"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none disabled:bg-gray-100"
                                        />
                                    </div>
                                </div>

                                {/* Dividend Formula Display */}
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <h5 className="font-bold text-gray-800 mb-2">Current Dividend Formula:</h5>
                                    <code className="text-sm text-gray-700 bg-gray-50 p-2 rounded block">
                                        Dividend = (Member Contribution / Total Contributions) × Net Profit
                                    </code>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Daily Report Rules Tab */}
                    {activeTab === 'reports' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">Daily Cash Report Rules</h3>
                                {canEdit && (
                                    <button
                                        onClick={() => handleSave('Report Rules')}
                                        className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-lg hover:bg-safaricom-dark transition-colors"
                                    >
                                        <FaSave /> Save Changes
                                    </button>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="font-bold text-gray-800">Block Next-Day Access if Report Missing</h4>
                                            <p className="text-xs text-gray-500">Prevents access to system if previous day's report is not submitted</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={reportRules.blockNextDayAccess}
                                                onChange={() => handleReportRuleToggle('blockNextDayAccess')}
                                                disabled={!canEdit}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-safaricom-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-safaricom-green"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="font-bold text-gray-800">Block Loan Approval if Cash Unbalanced</h4>
                                            <p className="text-xs text-gray-500">Prevents loan approval when daily cash report shows variance</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={reportRules.blockLoanIfUnbalanced}
                                                onChange={() => handleReportRuleToggle('blockLoanIfUnbalanced')}
                                                disabled={!canEdit}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-safaricom-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-safaricom-green"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="font-bold text-gray-800">Auto-Lock Report After Submission</h4>
                                            <p className="text-xs text-gray-500">Automatically locks report once submitted to prevent edits</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={reportRules.autoLockAfterSubmission}
                                                onChange={() => handleReportRuleToggle('autoLockAfterSubmission')}
                                                disabled={!canEdit}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-safaricom-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-safaricom-green"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="font-bold text-gray-800">Require Variance Explanation (if ≠ 0)</h4>
                                            <p className="text-xs text-gray-500">Mandatory explanation field when closing balance doesn't match expected</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={reportRules.requireVarianceExplanation}
                                                onChange={() => handleReportRuleToggle('requireVarianceExplanation')}
                                                disabled={!canEdit}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-safaricom-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-safaricom-green"></div>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h4 className="font-bold text-gray-800">Admin-Only Unlock Permission</h4>
                                            <p className="text-xs text-gray-500">Only Directors and Admins can unlock locked reports</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={reportRules.adminOnlyUnlock}
                                                onChange={() => handleReportRuleToggle('adminOnlyUnlock')}
                                                disabled={!canEdit}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-safaricom-green/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-safaricom-green"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Audit & Logs Tab */}
                    {activeTab === 'audit' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">Audit & Logs</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Search logs..."
                                        className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-safaricom-green/20 focus:border-safaricom-green outline-none text-sm"
                                    />
                                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-bold">
                                        Export CSV
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="text-left py-3 px-4 font-bold text-gray-700">User</th>
                                            <th className="text-left py-3 px-4 font-bold text-gray-700">Role</th>
                                            <th className="text-left py-3 px-4 font-bold text-gray-700">Action</th>
                                            <th className="text-left py-3 px-4 font-bold text-gray-700">Details</th>
                                            <th className="text-left py-3 px-4 font-bold text-gray-700">Timestamp</th>
                                            <th className="text-left py-3 px-4 font-bold text-gray-700">IP Address</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mockAuditLogs.map((log) => (
                                            <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-3 px-4 font-medium text-gray-800">{log.user}</td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-1 bg-safaricom-green/10 text-safaricom-dark rounded text-xs font-bold">
                                                        {log.role}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-medium text-gray-800">{log.action}</td>
                                                <td className="py-3 px-4 text-gray-600">{log.details}</td>
                                                <td className="py-3 px-4 text-gray-500">{log.timestamp}</td>
                                                <td className="py-3 px-4 text-gray-500 font-mono text-xs">{log.ip}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Backup & Data Control Tab */}
                    {activeTab === 'backup' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-bold text-gray-800">Backup & Data Control</h3>
                                {hasPermission(PERMISSIONS.BACKUP_RESTORE) && isDirector() && (
                                    <button
                                        onClick={() => {
                                            const check = checkPermission(user, PERMISSIONS.BACKUP_RESTORE, 'backup');
                                            if (!check.allowed) {
                                                toast.error(check.reason);
                                                return;
                                            }
                                            handleBackup();
                                        }}
                                        className="flex items-center gap-2 bg-safaricom-green text-white px-4 py-2 rounded-lg hover:bg-safaricom-dark transition-colors"
                                    >
                                        <FaDatabase /> Manual Backup
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white rounded-xl border border-gray-200 p-6">
                                    <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                                        <FaClock className="mr-2 text-safaricom-green" />
                                        Backup Status
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Last Backup:</span>
                                            <span className="text-sm font-bold text-gray-800">{backupStatus.lastBackup}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Status:</span>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                backupStatus.status === 'OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {backupStatus.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-600">Next Scheduled:</span>
                                            <span className="text-sm font-bold text-gray-800">{backupStatus.nextScheduled}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl border border-gray-200 p-6">
                                    <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                                        <FaExclamationTriangle className="mr-2 text-yellow-500" />
                                        Data Management
                                    </h4>
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-600">
                                            Only Directors can perform backup and restore operations. All data operations are logged in the audit trail.
                                        </p>
                                        {isDirector() && (
                                            <div className="space-y-2">
                                                <button className="w-full px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors text-sm font-bold">
                                                    Restore from Backup
                                                </button>
                                                <button className="w-full px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-bold">
                                                    Export All Data
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Action</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            {pendingAction?.type === 'save'
                                ? `Are you sure you want to save changes to ${pendingAction.section}? This action will be logged in the audit trail.`
                                : 'Are you sure you want to create a manual backup? This may take a few minutes.'}
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowConfirmModal(false);
                                    setPendingAction(null);
                                }}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAction}
                                className="px-4 py-2 bg-safaricom-green text-white rounded-lg hover:bg-safaricom-dark transition-colors font-bold"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;

