import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState({
        id: 1,
        email: 'admin@ukombozi.co.ke',
        name: 'Administrator',
        role: 'admin',
        groupId: null
    });
    const [loading, setLoading] = useState(false);

    const login = async (email, password) => {
        // Mock login
        const mockUser = { id: 1, email, name: email.split('@')[0], role: 'admin' };
        setUser(mockUser);
        return { user: mockUser };
    };

    const logout = async () => {
        setUser(null);
    };

    const resetPassword = async (email) => {
        console.log('Mock reset password for:', email);
    };

    const updateUserPassword = async (newPassword) => {
        console.log('Mock password update');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, resetPassword, updateUserPassword, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
