import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/AuthContext';
import ProtectedLayout from './components/ProtectedLayout'; // Import Protection
import LoginPage from './pages/LoginPage';

// App Version: 2.1.0-PREMIUM-AUTH (Force Refresh)
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import OfflineIndicator from './components/OfflineIndicator';

/**
 * Lazy Load with Retry - Fixes "ChunkLoadError" after new deployments
 * Forces a page reload one time if loading a chunk fails.
 */
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('ukombozi-retry-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('ukombozi-retry-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        console.log('🔄 ChunkLoadError detected. Force refreshing...');
        window.sessionStorage.setItem('ukombozi-retry-refreshed', 'true');
        window.location.reload();
        // Return pending promise to keep Suspense showing fallback during reload
        return new Promise(() => { });
      }
      throw error;
    }
  });

const DailyReports = lazyWithRetry(() => import('./pages/DailyReports'));

const Members = lazyWithRetry(() => import('./pages/Members'));
const Contributions = lazyWithRetry(() => import('./pages/Contributions'));
const Loans = lazyWithRetry(() => import('./pages/Loans'));
const DividendManagement = lazyWithRetry(() => import('./pages/DividendManagement'));
const Officers = lazyWithRetry(() => import('./pages/Officers'));
const Reconciliation = lazyWithRetry(() => import('./pages/Reconciliation'));
// const MemberProfile = lazyWithRetry(() => import('./pages/MemberProfile'));
// const AdminPanel = lazyWithRetry(() => import('./pages/AdminPanel'));
const DailyMeetingReport = lazyWithRetry(() => import('./pages/DailyMeetingReport'));
// const GroupMonthly = lazyWithRetry(() => import('./pages/GroupMonthly'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const MemberLedger = lazyWithRetry(() => import('./pages/MemberLedger'));
const LoanApprovals = lazyWithRetry(() => import('./pages/LoanApprovals'));
const MeetingSessions = lazyWithRetry(() => import('./pages/MeetingSessions'));
const CashReconciliation = lazyWithRetry(() => import('./pages/CashReconciliation'));
const SMSReports = lazyWithRetry(() => import('./pages/SMSReports'));
const ContributionCompliance = lazyWithRetry(() => import('./pages/ContributionCompliance'));
const LoanRepaymentTracking = lazyWithRetry(() => import('./pages/LoanRepaymentTracking'));
const SMSAutomationTest = lazyWithRetry(() => import('./pages/SMSAutomationTest'));
const AdminPanel = lazyWithRetry(() => import('./pages/AdminPanel'));
const LoanAdvisory = lazyWithRetry(() => import('./pages/LoanAdvisory'));
const CashControlModule = lazyWithRetry(() => import('./pages/CashControlModule'));
const GroupsManagement = lazyWithRetry(() => import('./pages/GroupsManagement'));
const CompanyPartnershipManager = lazyWithRetry(() => import('./pages/CompanyPartnershipManager'));
const CommunicationHub = lazyWithRetry(() => import('./pages/CommunicationHub'));
const ResetPasswordPage = lazyWithRetry(() => import('./pages/ResetPasswordPage'));
const FinancialReports = lazyWithRetry(() => import('./pages/FinancialReports'));
const ProjectManager = lazyWithRetry(() => import('./pages/ProjectManager'));
const GroupLedger = lazyWithRetry(() => import('./pages/GroupLedger'));
const GovernanceHub = lazyWithRetry(() => import('./pages/GovernanceHub'));
const AuditorMode = lazyWithRetry(() => import('./pages/AuditorMode'));
const OfficialsDirectory = lazyWithRetry(() => import('./pages/OfficialsDirectory'));
const RiskCommandCenter = lazyWithRetry(() => import('./pages/RiskCommandCenter'));
const MonthlyReports = lazyWithRetry(() => import('./pages/MonthlyReports'));
const ReversalCenter = lazyWithRetry(() => import('./pages/ReversalCenter'));
const CapitalManager = lazyWithRetry(() => import('./pages/CapitalManager'));




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
              <Route path="/daily-cash-report" element={<CashControlModule />} />
              <Route path="/daily-meeting-report" element={<DailyMeetingReport />} />
              <Route path="/project-manager" element={<ProjectManager />} />
              <Route path="/contribution-compliance" element={<ContributionCompliance />} />
              <Route path="/partnership-manager" element={<CompanyPartnershipManager />} />
              <Route path="/communication-hub" element={<CommunicationHub />} />
              <Route path="/financial-reports" element={<FinancialReports />} />
              <Route path="/monthly-cash-reports" element={<MonthlyReports />} />
            </Route>

            {/* Admin & Director Only Routes */}
            <Route element={<ProtectedLayout allowedRoles={['admin', 'director']}><Layout><Outlet /></Layout></ProtectedLayout>}>
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/groups" element={<GroupsManagement />} />
              <Route path="/groups/:id/ledger" element={<GroupLedger />} />
              <Route path="/officers" element={<Officers />} />
              <Route path="/dividends" element={<DividendManagement />} />
              <Route path="/sms-reports" element={<SMSReports />} />
              <Route path="/sms-automation-test" element={<SMSAutomationTest />} />
              <Route path="/governance-hub" element={<GovernanceHub />} />
              <Route path="/reversal-center" element={<ReversalCenter />} />
              <Route path="/auditor-mode" element={<AuditorMode />} />
              <Route path="/officials-directory" element={<OfficialsDirectory />} />
              <Route path="/risk-command-center" element={<RiskCommandCenter />} />
              <Route path="/capital-manager" element={<CapitalManager />} />
            </Route>

            {/* Catch all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ToastContainer position="top-right" autoClose={3000} />
          <OfflineIndicator />
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

// Simple outlet wrapper for Layout nesting


export default App;
