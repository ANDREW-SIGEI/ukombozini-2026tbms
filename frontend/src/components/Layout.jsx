import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { FiMenu, FiBell, FiUser, FiX } from 'react-icons/fi';

const Layout = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar (Desktop) */}
            <div className={`hidden md:block transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
                {isSidebarOpen && <Sidebar />}
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Mobile Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-safaricom-green z-50 transform transition-transform duration-300 ease-in-out md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex justify-between items-center p-4 border-b border-safaricom-dark text-white">
                    <span className="font-bold text-xl uppercase tracking-wider">TBMS Menu</span>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-white hover:text-gray-200">
                        <FiX size={24} />
                    </button>
                </div>
                <Sidebar isMobile={true} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
                {/* Topbar */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-10 sticky top-0">
                    <div className="flex items-center">
                        {/* Desktop Toggle */}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="hidden md:block text-gray-500 hover:text-safaricom-green mr-4 transition-colors"
                        >
                            <FiMenu size={24} />
                        </button>
                        {/* Mobile Toggle */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden text-gray-500 hover:text-safaricom-green mr-4 transition-colors"
                        >
                            <FiMenu size={24} />
                        </button>
                        <h1 className="text-lg font-bold text-gray-800 drop-shadow-sm">Ukombozi TBMS</h1>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="relative group">
                            <button className="text-gray-400 hover:text-safaricom-green p-2 rounded-full hover:bg-gray-100 transition-all">
                                <FiBell size={20} />
                                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                            </button>
                        </div>
                        <div className="flex items-center space-x-3 border-l pl-4 border-gray-100">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-gray-800">Field Officer</p>
                                <p className="text-[10px] text-gray-500">ID: #4052</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-safaricom-green flex items-center justify-center text-white shadow-md shadow-green-900/20">
                                <FiUser size={20} />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50/50 p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default Layout;
