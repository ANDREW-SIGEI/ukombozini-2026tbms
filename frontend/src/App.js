import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useNavigate, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedLayout from './components/ProtectedLayout'; // Import Protection
import LoginPage from './pages/LoginPage';

// App Version: 2.1.0-PREMIUM-AUTH (Force Refresh)
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
const DailyReports = lazy(() => import('./pages/DailyReports'));
const Members = lazy(() => import('./pages/Members'));
const Contributions = lazy(() => import('./pages/Contributions'));
const Loans = lazy(() => import('./pages/Loans'));
const DividendManagement = lazy(() => import('./pages/DividendManagement'));
const Officers = lazy(() => import('./pages/Officers'));
const Reconciliation = lazy(() => import('./pages/Reconciliation'));
// const MemberProfile = lazy(() => import('./pages/MemberProfile'));
// const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const DailyMeetingReport = lazy(() => import('./pages/DailyMeetingReport'));
// const GroupMonthly = lazy(() => import('./pages/GroupMonthly'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const MemberLedger = lazy(() => import('./pages/MemberLedger'));
const LoanApprovals = lazy(() => import('./pages/LoanApprovals'));
const MeetingSessions = lazy(() => import('./pages/MeetingSessions'));
const CashReconciliation = lazy(() => import('./pages/CashReconciliation'));
const SMSReports = lazy(() => import('./pages/SMSReports'));
const ContributionCompliance = lazy(() => import('./pages/ContributionCompliance'));
const LoanRepaymentTracking = lazy(() => import('./pages/LoanRepaymentTracking'));
const SMSAutomationTest = lazy(() => import('./pages/SMSAutomationTest'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const LoanAdvisory = lazy(() => import('./pages/LoanAdvisory'));
const GroupsManagement = lazy(() => import('./pages/GroupsManagement'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));


// Profile component
const Profile = () => {
  const { user } = useAuth();

  // Generate initials from the user's name
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <div className="p-8 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      <div className="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-safaricom-green text-white flex items-center justify-center text-4xl font-bold mb-4 shadow-lg shadow-green-900/20">
          {getInitials(user?.name)}
        </div>
        <h2 className="text-xl font-bold text-gray-800">{user?.name || 'User'}</h2>
        <p className="text-gray-500 mb-6">{user?.email || ''}</p>

        <div className="w-full space-y-4">
          <div className="flex justify-between">
            <span className="text-gray-500">Role:</span>
            <span className="font-medium text-gray-800">{user?.role || 'Guest'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Member Since:</span>
            <span className="font-medium text-gray-800">Jan 2023</span>
          </div>
        </div>

        <button className="mt-8 w-full bg-safaricom-green hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors">
          Edit Profile
        </button>
      </div>
    </div>
  );
};

// Example protected route wrapper
const ProtectedRoute = ({ children, isAdmin }) => {
  const userIsAdmin = true; // replace with real auth check
  return isAdmin && !userIsAdmin ? <Navigate to='/' /> : children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Suspense fallback={<div className="p-8">Loading...</div>}>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Authenticated Routes */}
            <Route element={<ProtectedLayout><Layout><Outlet /></Layout></ProtectedLayout>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/members" element={<Members />} />
              <Route path="/members/:id" element={<MemberLedger />} />
              <Route path="/contributions" element={<Contributions />} />
              <Route path="/loans" element={<Loans />} />
              <Route path="/loan-approvals" element={<LoanApprovals />} />
              <Route path="/loan-advisory" element={<LoanAdvisory />} />
              <Route path="/loan-repayment-tracking" element={<LoanRepaymentTracking />} />
              <Route path="/reconciliation" element={<Reconciliation />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/meeting-sessions" element={<MeetingSessions />} />
              <Route path="/cash-reconciliation" element={<CashReconciliation />} />
              <Route path="/daily-reports" element={<DailyReports />} />
              <Route path="/daily-meeting-report" element={<DailyMeetingReport />} />
              <Route path="/contribution-compliance" element={<ContributionCompliance />} />
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>

            {/* Admin & Director Only Routes */}
            <Route element={<ProtectedLayout allowedRoles={['admin', 'director']}><Layout><Outlet /></Layout></ProtectedLayout>}>
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/groups" element={<GroupsManagement />} />
              <Route path="/officers" element={<Officers />} />
              <Route path="/dividends" element={<DividendManagement />} />
              <Route path="/sms-reports" element={<SMSReports />} />
              <Route path="/sms-automation-test" element={<SMSAutomationTest />} />
            </Route>

            {/* Catch all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer position="top-right" autoClose={3000} />
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

// Simple outlet wrapper for Layout nesting


export default App;
