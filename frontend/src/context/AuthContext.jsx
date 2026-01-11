import React, { createContext, useContext, useState, useEffect } from 'react';

// Mock current user - In production, get from API/auth service
const mockCurrentUser = {
    id: 1,
    name: 'Hilda Sigei',
    email: 'hilda@ukombozi.com',
    role: 'Director',
    roleId: 1,
    permissions: [
        'create_user',
        'edit_user',
        'delete_user',
        'approve_loan',
        'reverse_transaction',
        'edit_system_rules',
        'submit_cash_report',
        'approve_cash_report',
        'unlock_cash_report',
        'view_audit_logs',
        'export_data',
        'backup_restore',
        'post_contribution',
        'issue_loan',
    ],
};

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(mockCurrentUser);
    const [loading, setLoading] = useState(false);

    // In production, fetch user from API
    useEffect(() => {
        // Simulate API call
        // fetchUser().then(setUser).finally(() => setLoading(false));
    }, []);

    const hasPermission = (permissionKey) => {
        if (!user) return false;
        return user.permissions?.includes(permissionKey) || false;
    };

    const hasRole = (roleName) => {
        if (!user) return false;
        return user.role === roleName;
    };

    const canEdit = () => {
        return hasRole('Director') || hasRole('Admin');
    };

    const isDirector = () => {
        return hasRole('Director');
    };

    const isAdmin = () => {
        return hasRole('Admin');
    };

    const isSupervisor = () => {
        return hasRole('Supervisor');
    };

    const isFieldOfficer = () => {
        return hasRole('FieldOfficer') || hasRole('Field Officer');
    };

    const value = {
        user,
        setUser,
        loading,
        hasPermission,
        hasRole,
        canEdit,
        isDirector,
        isAdmin,
        isSupervisor,
        isFieldOfficer,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

