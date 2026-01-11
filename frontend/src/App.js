import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Components
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import DailyReports from './pages/DailyReports';
import Members from './pages/Members';
import Contributions from './pages/Contributions';
import Loans from './pages/Loans';
import Dividends from './pages/Dividends';
import Officers from './pages/Officers';
import Reconciliation from './pages/Reconciliation';
import MemberProfile from './pages/MemberProfile';
import AdminPanel from './pages/AdminPanel';
const Notifications = () => <div className="p-8"><h1 className="text-2xl font-bold mb-4">Notifications</h1><div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-4">
  {[1, 2, 3].map(i => <div key={i} className="p-4 border-l-4 border-safaricom-green bg-gray-50 rounded-r-lg">
    <p className="text-sm font-bold text-gray-800">Notification Title {i}</p>
    <p className="text-xs text-gray-500">System message regarding performance and alerts.</p>
  </div>)}
</div></div>;
const Profile = () => <div className="p-8 min-h-screen bg-gray-50"><h1 className="text-2xl font-bold mb-6">My Profile</h1><div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
  <div className="w-24 h-24 rounded-full bg-safaricom-green text-white flex items-center justify-center text-4xl font-bold mb-4 shadow-lg shadow-green-900/20">JS</div>
  <h2 className="text-xl font-bold text-gray-800">Field Officer Name</h2>
  <p className="text-safaricom-dark font-bold text-sm mb-6">ADMINISTRATOR</p>
  <div className="w-full space-y-4">
    <div className="flex justify-between text-sm py-2 border-b"><span className="text-gray-400">Email</span><span className="font-medium text-gray-800">officer@ukombozi.com</span></div>
    <div className="flex justify-between text-sm py-2 border-b"><span className="text-gray-400">Phone</span><span className="font-medium text-gray-800">+254 712 345 678</span></div>
    <div className="flex justify-between text-sm py-2 border-b"><span className="text-gray-400">Joined</span><span className="font-medium text-gray-800">Jan 12, 2025</span></div>
  </div>
</div></div>;

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/:id" element={<MemberProfile />} />
          <Route path="/contributions" element={<Contributions />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/dividends" element={<Dividends />} />
          <Route path="/officers" element={<Officers />} />
          <Route path="/reconciliation" element={<Reconciliation />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/daily-reports" element={<DailyReports />} />
        </Routes>
      </Layout>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
  );
}

export default App;
