import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaLock, FaSpinner, FaEye, FaEyeSlash, FaCheckCircle } from 'react-icons/fa';

const ResetPasswordPage = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const { updateUserPassword } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return toast.error('Passwords do not match');
        }

        if (password.length < 6) {
            return toast.error('Password must be at least 6 characters');
        }

        setLoading(true);
        try {
            await updateUserPassword(password);
            setSuccess(true);
            toast.success('Password updated successfully!');
            setTimeout(() => navigate('/login'), 3000);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-6 lg:px-8 font-sans">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-safaricom-green">UKOMBOZI</h1>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mt-1">Institutional TBMS</p>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-10 px-6 sm:px-12 shadow-2xl rounded-3xl border border-gray-100">
                    {success ? (
                        <div className="text-center animate-in fade-in zoom-in-95 duration-500">
                            <div className="w-20 h-20 bg-green-100 text-safaricom-green rounded-full flex items-center justify-center mx-auto mb-6">
                                <FaCheckCircle className="text-4xl" />
                            </div>
                            <h3 className="text-2xl font-black text-gray-900 mb-2">Password Secured</h3>
                            <p className="text-gray-500 text-sm font-medium">
                                Your access key has been successfully updated. Redirecting to terminal...
                            </p>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="mb-10 text-center">
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight">Set New Access Key</h3>
                                <p className="text-gray-400 mt-2 text-sm font-medium">Please define a strong password for your identity.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block text-center">New Password</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-300 group-focus-within:text-safaricom-green transition-colors">
                                            <FaLock />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-safaricom-green focus:bg-white rounded-2xl py-4 pl-12 pr-12 text-sm font-semibold transition-all outline-none"
                                            placeholder="Min. 6 characters"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-300 hover:text-safaricom-green transition-colors"
                                        >
                                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block text-center">Confirm Password</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-300 group-focus-within:text-safaricom-green transition-colors">
                                            <FaLock />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full bg-gray-50 border-2 border-transparent focus:border-safaricom-green focus:bg-white rounded-2xl py-4 pl-12 pr-4 text-sm font-semibold transition-all outline-none"
                                            placeholder="Match password"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-safaricom-green hover:bg-safaricom-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-green-900/10 transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center space-x-3 uppercase tracking-widest text-xs"
                                >
                                    {loading ? <FaSpinner className="animate-spin text-lg" /> : <span>Update Password</span>}
                                </button>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
