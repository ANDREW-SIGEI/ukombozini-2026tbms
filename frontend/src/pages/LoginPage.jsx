/**
 * UKOMBOZI Institutional TBMS - Premium Login v2.2
 * Redesigned: Jan 2026
 * Features: Login, Registration, Password Reset, Pass-Toggle
 */
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
    FaLock, FaUser, FaSpinner, FaEye, FaEyeSlash,
    FaArrowLeft, FaCheckCircle, FaEnvelope, FaIdCard
} from 'react-icons/fa';

const LoginPage = () => {
    // Form States
    const [view, setView] = useState('login'); // 'login', 'reset', or 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [debugMsg, setDebugMsg] = useState('System: Ready (Local)');

    const { login, signup, resetPassword } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const mounted = useRef(true);

    const from = location.state?.from?.pathname || '/';

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setDebugMsg('System: AUTH_START');
        setLoading(true);

        try {
            await login(email, password);

            setDebugMsg('System: AUTH_GRANTED');

            if (mounted.current) {
                toast.success('Access Granted. Welcome back!');
                navigate(from, { replace: true });
            }
        } catch (error) {
            console.error('Login failed:', error);
            setDebugMsg('System: AUTH_FAILED');

            if (mounted.current) {
                toast.error(error.message || 'Invalid email or password');
            }
        } finally {
            if (mounted.current) setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        try {
            e.preventDefault();
            setLoading(true);

            // Using AuthContext signup which might throw or alert
            await signup(email, password, { full_name: fullName });

            // If we get here (and it didn't throw), it means success
            if (mounted.current) {
                toast.success('Registration request sent. Please contact Admin for approval.');
                setView('login');
            }

        } catch (error) {
            console.error('Signup failed:', error);
            // Error already handled/alerted in context usually, but toast here too
            if (mounted.current) toast.error(error.message);
        } finally {
            if (mounted.current) setLoading(false);
        }
    };

    const handleResetRequest = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await resetPassword(email);
            if (mounted.current) {
                setResetSent(true);
                toast.success('If this email is registered, a reset link has been sent.');
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            if (mounted.current) setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-sans overflow-hidden">
            {/* Left Side: Visual/Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-900 border-r border-gray-100">
                <img
                    src="/login_backdrop_vibrant_kenya.png"
                    alt="Ukombozi TBMS"
                    className="absolute inset-0 w-full h-full object-cover opacity-80 shadow-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none" />

                <div className="relative z-10 flex flex-col justify-center px-20">
                    <div className="mb-10">
                        <div className="bg-safaricom-green w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl border border-white/10">
                            <h1 className="text-5xl font-black text-white italic tracking-tighter">U</h1>
                        </div>
                    </div>
                    <h2 className="text-7xl font-black text-white leading-tight tracking-tighter">
                        Institutional <br />
                        <span className="text-safaricom-green drop-shadow-[0_2px_10px_rgba(42,159,81,0.3)]">Table Banking</span> <br />
                        Excellence.
                    </h2>
                    <p className="mt-8 text-xl text-gray-200/90 max-w-md font-medium leading-relaxed">
                        Secure, transparent, and efficient wealth management for community-based financial institutions.
                    </p>

                    <div className="mt-14 flex space-x-12">
                        <div className="backdrop-blur-md bg-white/5 p-4 rounded-2xl border border-white/10">
                            <p className="text-white font-black text-2xl">Local</p>
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mt-1 text-nowrap">Server Mode</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Forms */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-24 bg-gray-50/50 relative overflow-y-auto pt-12 pb-12">
                <div className="max-w-md w-full mx-auto">
                    {/* Header for Mobile */}
                    <div className="lg:hidden mb-12 text-center">
                        <h1 className="text-4xl font-black text-safaricom-green tracking-tight">UKOMBOZI</h1>
                        <p className="text-[10px] uppercase font-black tracking-[0.3em] text-gray-400 mt-2">Institutional Terminal</p>
                    </div>

                    {view === 'login' && (
                        <div className="animate-in fade-in duration-700 slide-in-from-bottom-4">
                            <div className="mb-12">
                                <h3 className="text-4xl font-black text-gray-900 tracking-tighter">Terminal Access</h3>
                                <p className="text-gray-500 mt-3 font-semibold text-sm">Please authorize your identity to begin.</p>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Corporate Identifier</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-safaricom-green text-gray-300">
                                            <FaUser />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-white border-2 border-gray-100 rounded-3xl py-5 pl-14 pr-4 text-sm font-bold focus:border-safaricom-green focus:bg-white focus:ring-0 transition-all outline-none shadow-sm hover:border-gray-300"
                                            placeholder="officer@ukombozi.co.ke"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Security Token</label>
                                        <button
                                            type="button"
                                            onClick={() => setView('reset')}
                                            className="text-[10px] font-black text-safaricom-green hover:text-safaricom-dark uppercase tracking-widest transition-colors"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-safaricom-green text-gray-300">
                                            <FaLock />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white border-2 border-gray-100 rounded-3xl py-5 pl-14 pr-16 text-sm font-bold focus:border-safaricom-green focus:bg-white focus:ring-0 transition-all outline-none shadow-sm hover:border-gray-300"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-6 flex items-center text-gray-300 hover:text-safaricom-green transition-colors"
                                        >
                                            {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-safaricom-green hover:bg-safaricom-dark text-white font-black py-5 rounded-3xl shadow-2xl shadow-green-900/40 transition-all transform hover:-translate-y-1 active:scale-[0.97] disabled:opacity-70 flex items-center justify-center space-x-3 uppercase tracking-[0.2em] text-xs"
                                >
                                    {loading ? <FaSpinner className="animate-spin text-xl" /> : <span>Grant Entry Authorization</span>}
                                </button>

                                <div className="text-center mt-8">
                                    <p className="text-xs text-gray-500 font-semibold">
                                        Need an account?{' '}
                                        <button
                                            type="button"
                                            onClick={() => setView('register')}
                                            className="text-safaricom-green font-black hover:underline underline-offset-4"
                                        >
                                            Register Identity
                                        </button>
                                    </p>
                                </div>
                            </form>
                        </div>
                    )}

                    {view === 'register' && (
                        <div className="animate-in fade-in duration-700 slide-in-from-bottom-4">
                            <button
                                onClick={() => setView('login')}
                                className="flex items-center text-[10px] font-black text-gray-400 hover:text-safaricom-green transition-colors uppercase tracking-[0.2em] mb-10 group"
                            >
                                <FaArrowLeft className="mr-3 transition-transform group-hover:-translate-x-1" />
                                Return to primary login
                            </button>

                            <div className="mb-12">
                                <h3 className="text-4xl font-black text-gray-900 tracking-tighter">Register Identity</h3>
                                <p className="text-gray-500 mt-3 font-semibold text-sm">Create your official officer account.</p>
                            </div>

                            <form onSubmit={handleRegister} className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Full Name</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-safaricom-green text-gray-300">
                                            <FaIdCard />
                                        </div>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full bg-white border-2 border-gray-100 rounded-3xl py-5 pl-14 pr-4 text-sm font-bold focus:border-safaricom-green transition-all outline-none shadow-sm"
                                            placeholder="John Doe"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">System Email</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-safaricom-green text-gray-300">
                                            <FaEnvelope />
                                        </div>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-white border-2 border-gray-100 rounded-3xl py-5 pl-14 pr-4 text-sm font-bold focus:border-safaricom-green transition-all outline-none shadow-sm"
                                            placeholder="officer@ukombozi.co.ke"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">Secret Token</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none transition-colors group-focus-within:text-safaricom-green text-gray-300">
                                            <FaLock />
                                        </div>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-white border-2 border-gray-100 rounded-3xl py-5 pl-14 pr-16 text-sm font-bold focus:border-safaricom-green transition-all outline-none shadow-sm"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-6 flex items-center text-gray-300 hover:text-safaricom-green transition-colors"
                                        >
                                            {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-black hover:bg-gray-800 text-white font-black py-5 rounded-3xl shadow-2xl transition-all transform hover:-translate-y-1 active:scale-[0.97] disabled:opacity-70 flex items-center justify-center space-x-3 uppercase tracking-[0.2em] text-xs"
                                >
                                    {loading ? <FaSpinner className="animate-spin text-xl" /> : <span>Initialize Account</span>}
                                </button>
                            </form>
                        </div>
                    )}

                    {view === 'reset' && (
                        <div className="animate-in fade-in duration-800 zoom-in-95">
                            <button
                                onClick={() => { setView('login'); setResetSent(false); }}
                                className="flex items-center text-[10px] font-black text-gray-400 hover:text-safaricom-green transition-colors uppercase tracking-[0.2em] mb-12 group"
                            >
                                <FaArrowLeft className="mr-3 transition-transform group-hover:-translate-x-1" />
                                Return to primary login
                            </button>

                            {!resetSent ? (
                                <>
                                    <div className="mb-12">
                                        <h3 className="text-4xl font-black text-gray-900 tracking-tighter">Account Recovery</h3>
                                        <p className="text-gray-500 mt-3 font-semibold text-sm">A secure transmission will be sent to your inbox.</p>
                                    </div>

                                    <form onSubmit={handleResetRequest} className="space-y-8">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Security Email</label>
                                            <div className="relative group">
                                                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-gray-300 group-focus-within:text-safaricom-green transition-colors">
                                                    <FaEnvelope />
                                                </div>
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="w-full bg-white border-2 border-gray-100 rounded-3xl py-5 pl-14 pr-4 text-sm font-bold focus:border-safaricom-green transition-all outline-none shadow-sm"
                                                    placeholder="Enter your registered email"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full bg-black hover:bg-gray-800 text-white font-black py-5 rounded-3xl shadow-2xl shadow-black/30 transition-all hover:-translate-y-1 active:scale-[0.97] disabled:opacity-70 flex items-center justify-center space-x-3 uppercase tracking-[0.2em] text-xs"
                                        >
                                            {loading ? <FaSpinner className="animate-spin text-xl" /> : <span>Initialize Recovery</span>}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="text-center py-10">
                                    <div className="w-24 h-24 bg-green-50 text-safaricom-green rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                                        <FaCheckCircle size={48} />
                                    </div>
                                    <h3 className="text-3xl font-black text-gray-900 tracking-tighter mb-4">Transmission Sent</h3>
                                    <p className="text-gray-500 text-sm font-semibold mb-10 leading-relaxed px-4">
                                        A secure recovery token has been transmitted to <br />
                                        <span className="font-black text-gray-900 underline decoration-safaricom-green decoration-2">{email}</span>.
                                    </p>
                                    <button
                                        onClick={() => setResetSent(false)}
                                        className="text-[10px] font-black text-safaricom-green hover:underline uppercase tracking-[0.2em] transition-all"
                                    >
                                        Re-transmit Token?
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-24 border-t border-gray-100 pt-10 text-center">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.4em] mb-4">
                            &copy; 2026 UKOMBOZI TBMS &bull; SECURED TERMINAL &bull; V2.6-DIAGNOSTIC
                        </p>
                        <div className="flex justify-center items-center space-x-3">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-safaricom-green opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-safaricom-green"></span>
                            </span>
                            <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Global Status: Operational</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
