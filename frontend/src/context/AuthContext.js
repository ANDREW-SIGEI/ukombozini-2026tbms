import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        checkAuth();

        return () => {
            mounted.current = false;
        };
    }, []);

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('ukombozini_token');
            if (token) {
                const userData = await api.getMe();
                if (userData && mounted.current) {
                    setUser(userData);
                } else if (mounted.current) {
                    // Token invalid or expired
                    localStorage.removeItem('ukombozini_token');
                    setUser(null);
                }
            } else {
                if (mounted.current) setUser(null);
            }
        } catch (error) {
            console.error("Auth check failed:", error);
            if (mounted.current) setUser(null);
        } finally {
            if (mounted.current) setLoading(false);
        }
    };

    const login = async (email, password) => {
        const data = await api.login(email, password);
        if (data && data.user) {
            setUser(data.user);
            return data;
        } else {
            throw new Error(data?.message || 'Login failed');
        }
    };

    const signup = async (email, password, metadata) => {
        // Local backend usually doesn't allow public signup, generally admin-only
        // We can either implement api.signup if it exists or throw an error
        alert("Registration is restricted to Administrators. Please contact the office.");
        throw new Error("Registration restricted");
    };

    const logout = () => {
        api.logout();
        setUser(null);
    };

    const resetPassword = async (email) => {
        // Implement if backend supports it, else mock or warn
        await api.resetOfficerPassword(email);
    };

    const updateUserPassword = async (newPassword) => {
        const res = await api.updateMyPassword(newPassword);
        return res;
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, logout, resetPassword, updateUserPassword, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
