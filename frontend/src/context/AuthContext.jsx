import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

const PERMISSIONS = {
    admin: ['all'],
    director: ['all'],
    supervisor: ['view', 'approve'],
    field_officer: ['view', 'create'],
    auditor: ['view']
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('ukombozini_token');
            if (token) {
                const userData = await api.getMe();
                if (userData) {
                    setUser({
                        ...userData,
                        permissions: PERMISSIONS[userData.role] || []
                    });
                } else {
                    localStorage.removeItem('ukombozini_token');
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const hasPermission = (permissionKey) => {
        if (!user) return false;
        if (user.permissions?.includes('all')) return true;
        return user.permissions?.includes(permissionKey) || false;
    };

    const hasRole = (roleName) => {
        if (!user || !user.role) return false;
        return user.role === roleName.toLowerCase();
    };

    const isDirector = hasRole('director');
    const isAdmin = hasRole('admin');
    const isSupervisor = hasRole('supervisor') || isDirector;
    const isFieldOfficer = hasRole('field_officer');
    const isAuditor = hasRole('auditor');
    const isReadOnly = isAuditor || (!isDirector && !isAdmin);
    const canEdit = (isDirector || isAdmin) && !isAuditor;

    const login = async (email, password) => {
        const data = await api.login(email, password);
        if (data?.user) {
            setUser({
                ...data.user,
                permissions: PERMISSIONS[data.user.role] || []
            });
            return data;
        }
        throw new Error('Login failed');
    };

    const logout = async () => {
        api.logout();
        setUser(null);
    };

    const resetPassword = async (email) => {
        return await api.resetOfficerPassword(email);
    };

    const value = {
        user,
        setUser,
        loading,
        login,
        logout,
        resetPassword,
        hasPermission,
        hasRole,
        canEdit,
        isDirector,
        isAdmin,
        isSupervisor,
        isFieldOfficer,
        isAuditor,
        isReadOnly,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
