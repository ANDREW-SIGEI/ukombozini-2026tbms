import axios from 'axios';
import { toast } from 'react-toastify';


/**
 * UKOMBOZI Table Banking System - API Service
 * Decoupled from Supabase, now using Local Node.js / SQLite backend.
 */

const API_URL = 'http://localhost:5001/api';

const axiosInstance = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add Token Interceptor
axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('ukombozi_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

const handleApiError = (error) => {
    console.error('API Error:', error.response?.data || error.message);
    const msg = error.response?.data?.error || 'An unexpected error occurred';
    toast.error(msg);
    throw error;
};

export const api = {
    // ========================================
    // CORE MEMBER & GROUP API
    // ========================================

    async getMember(id) {
        try {
            const response = await axiosInstance.get(`/members/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    // Basic Member/Group methods are defined in the overrides section at the end

    async getLatestCashSession(groupId) {
        try {
            const response = await axiosInstance.get(`/sessions/latest`, { params: { groupId } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getProjectMemberDayLimit(memberId) {
        try {
            const response = await axiosInstance.get(`/members/${memberId}/day-limit`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // PHASE 2: AUDIT & GOVERNANCE
    // ========================================

    async getAuditSnapshot(date, groupId = null) {
        try {
            const response = await axiosInstance.get('/audit/snapshot', { params: { date, groupId } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // UNIFIED TRANSACTION POSTING API
    // Routes to appropriate engine based on type
    // ========================================


    // Unified Transaction methods are defined at the end

    // ========================================
    // CONTRIBUTION ENGINE API
    // ========================================

    async validateContribution(data) {
        try {
            const response = await axiosInstance.post('/contributions/validate', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async postContribution(data) {
        try {
            const response = await axiosInstance.post('/contributions/post', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getContributionHistory(memberId) {
        try {
            const response = await axiosInstance.get(`/contributions/history/${memberId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // WITHDRAWAL ENGINE API
    // ========================================

    async validateWithdrawal(data) {
        try {
            const response = await axiosInstance.post('/withdrawals/validate', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async postWithdrawal(data) {
        try {
            const response = await axiosInstance.post('/withdrawals/post', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getWithdrawalHistory(memberId) {
        try {
            const response = await axiosInstance.get(`/withdrawals/history/${memberId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // LOAN DISBURSEMENT ENGINE API
    // ========================================

    async checkLoanEligibility(data) {
        try {
            const response = await axiosInstance.post('/loans/check-eligibility', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async processLoanRepayment(data) {
        try {
            const response = await axiosInstance.post('/loans/repay', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanArrears(loanId) {
        try {
            const response = await axiosInstance.get(`/loans/${loanId}/arrears`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanPayments(loanId) {
        try {
            const response = await axiosInstance.get(`/loans/${loanId}/payments`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // MEMBER STATEMENT API
    // ========================================

    async getMemberStatement(memberId, startDate = null, endDate = null) {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const response = await axiosInstance.get(`/statements/member/${memberId}`, { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    downloadMemberStatementPDF(memberId, startDate = null, endDate = null) {
        const token = localStorage.getItem('ukombozi_token');
        let url = `${API_URL}/statements/member/${memberId}/pdf`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        // Create a temporary link to download
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '');

        // Add auth header via fetch for PDF download
        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            link.href = blobUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('PDF Download error:', err));
    },

    downloadMemberStatementExcel(memberId, startDate = null, endDate = null) {
        const token = localStorage.getItem('ukombozi_token');
        let url = `${API_URL}/statements/member/${memberId}/excel`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('Excel Download error:', err));
    },

    // ========================================
    // GROUP STATEMENT API
    // ========================================

    async getGroupStatement(groupId, startDate = null, endDate = null) {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            const response = await axiosInstance.get(`/statements/group/${groupId}`, { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    downloadGroupStatementPDF(groupId, startDate = null, endDate = null) {
        const token = localStorage.getItem('ukombozi_token');
        let url = `${API_URL}/statements/group/${groupId}/pdf`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('PDF Download error:', err));
    },

    downloadGroupStatementExcel(groupId, startDate = null, endDate = null) {
        const token = localStorage.getItem('ukombozi_token');
        let url = `${API_URL}/statements/group/${groupId}/excel`;
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('Excel Download error:', err));
    },

    // ========================================
    // DIVIDEND REPORT API
    // ========================================

    downloadDividendReportPDF(runId) {
        const token = localStorage.getItem('ukombozi_token');
        const url = `${API_URL}/dividend-runs/${runId}/pdf`;

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.blob()).then(blob => {
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', '');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        }).catch(err => console.error('PDF Download error:', err));
    },

    // ========================================
    // RECONCILIATION API
    // ========================================

    async createReconciliation(sessionId, actualCash, notes = null) {
        try {
            const response = await axiosInstance.post('/reconciliation/session', {
                sessionId,
                actualCash,
                notes
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getSessionReconciliation(sessionId) {
        try {
            const response = await axiosInstance.get(`/reconciliation/session/${sessionId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getDiscrepancies(status = null, groupId = null) {
        try {
            const params = {};
            if (status) params.status = status;
            if (groupId) params.groupId = groupId;
            const response = await axiosInstance.get('/reconciliation/discrepancies', { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async resolveDiscrepancy(recId, resolutionNotes) {
        try {
            const response = await axiosInstance.post(`/reconciliation/${recId}/resolve`, {
                resolutionNotes
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getReconciliationDashboard() {
        try {
            const response = await axiosInstance.get('/reconciliation/dashboard');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // ARREARS TRACKING API
    // ========================================

    async getArrearsSummary(groupId = null) {
        try {
            const params = {};
            if (groupId) params.groupId = groupId;
            const response = await axiosInstance.get('/arrears/summary', { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getArrearsMembers(status = null, groupId = null, sortBy = null) {
        try {
            const params = {};
            if (status) params.status = status;
            if (groupId) params.groupId = groupId;
            if (sortBy) params.sortBy = sortBy;
            const response = await axiosInstance.get('/arrears/members', { params });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async sendArrearsReminders(memberIds, customMessage = null) {
        try {
            const response = await axiosInstance.post('/arrears/notify', {
                memberIds,
                customMessage
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getArrearsHistory(memberId) {
        try {
            const response = await axiosInstance.get(`/arrears/history/${memberId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DIRECTOR DASHBOARD API
    // ========================================

    async getDirectorDashboard() {
        try {
            const response = await axiosInstance.get('/dashboard/director');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getPortfolioAnalytics() {
        try {
            const response = await axiosInstance.get('/dashboard/portfolio');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGroupRankings() {
        try {
            const response = await axiosInstance.get('/dashboard/groups');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getActivityFeed(limit = 20) {
        try {
            const response = await axiosInstance.get('/dashboard/activity', { params: { limit } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async toggleFreeze(targetType, targetId, action, reason) {
        try {
            const response = await axiosInstance.post('/governance/freeze', { targetType, targetId, action, reason });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGovernanceStatus() {
        try {
            const response = await axiosInstance.get('/governance/status');
            return response.data;
        } catch (error) {
            console.error('getGovernanceStatus error:', error);
            // Default safe state
            return { system_lockdown: false };
        }
    },



    async getRiskOverview() {
        try {
            const response = await axiosInstance.get('/risk/overview');
            return response.data;
        } catch (error) {
            console.error('getRiskOverview error:', error);
            return { groups: [], stats: {} };
        }
    },

    async getRiskDashboard() {
        try {
            const response = await axiosInstance.get('/risk/dashboard');
            return response.data;
        } catch (error) {
            console.error('getRiskDashboard error:', error);
            return { scores: [], alerts: [], heatmap: [] };
        }
    },
    async requestReversal(transactionId, reason) {
        try {
            const response = await axiosInstance.post('/reversals/request', { transaction_id: transactionId, reason });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    async approveReversal(requestId) {
        try {
            const response = await axiosInstance.post('/reversals/approve', { request_id: requestId });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    async getReversalRequests() {
        try {
            const response = await axiosInstance.get('/reversals/requests');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },
    async unlockSession(sessionId, reason) {
        try {
            const response = await axiosInstance.post('/reversals/unlock-session', { sessionId, reason });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getFreezeLogs() {
        try {
            const response = await axiosInstance.get('/governance/freeze-logs');
            return response.data;
        } catch (error) {
            console.error('getFreezeLogs error:', error);
            return [];
        }
    },

    async getRiskScore(scope, id) {
        try {
            const response = await axiosInstance.get(`/risk/${scope.toLowerCase()}/${id}`);
            return response.data;
        } catch (error) {
            console.error(`getRiskScore for ${scope} error:`, error);
            return null;
        }
    },

    async getSystemSettings() {
        try {
            const response = await axiosInstance.get('/admin/system-settings');
            return response.data;
        } catch (error) {
            console.error('getSystemSettings error:', error);
            return [];
        }
    },

    async getDashboardStats() {
        try {
            const response = await axiosInstance.get('/dashboard/stats');
            return response.data;
        } catch (error) {
            console.error('getDashboardStats error:', error);
            return null;
        }
    },

    // ========================================
    // CASH CONTROL & RECONCILIATION (Bank-Grade)
    // ========================================
    async openCashSession(groupId, date) {
        try {
            const response = await axiosInstance.post('/cash-sessions/open', { groupId, date });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getCashSessionContext(sessionId) {
        try {
            const response = await axiosInstance.get(`/cash-sessions/${sessionId}/context`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async verifyAndLockCashSession(sessionId, data) {
        try {
            const response = await axiosInstance.patch(`/cash-sessions/${sessionId}/verify`, data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLatestCashSession(groupId) {
        try {
            const response = await axiosInstance.get(`/cash-sessions/latest/${groupId}`);
            return response.data;
        } catch (error) {
            console.error('getLatestCashSession error:', error);
            return null;
        }
    },

    async getMonthlyReports(filters = {}) {
        try {
            const response = await axiosInstance.get('/monthly-reports', { params: filters });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getMonthlyReportDetails(id) {
        try {
            const response = await axiosInstance.get(`/monthly-reports/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // MEETING SUMMARY (New)
    // ========================================

    async getMeetingSummary(sessionId) {
        try {
            const response = await axiosInstance.get(`/sessions/${sessionId}/summary`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // AUTHENTICATION
    // ========================================

    async login(email, password) {
        try {
            const response = await axiosInstance.post('/auth/login', { email, password });
            if (response.data.token) {
                localStorage.setItem('ukombozi_token', response.data.token);
            }
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getMe() {
        try {
            const response = await axiosInstance.get('/auth/me');
            return response.data;
        } catch (error) {
            // No toast for quiet check
            if (error.response?.status !== 401) {
                console.error('getMe error:', error);
            }
            return null;
        }
    },

    logout() {
        localStorage.removeItem('ukombozi_token');
    },

    // ========================================
    // REPORTS (PDF)
    // ========================================



    async downloadMemberStatement(memberId, startDate, endDate) {
        try {
            const response = await axiosInstance.get(`/reports/member/${memberId}`, {
                params: { startDate, endDate },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `statement_${memberId}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadMemberExcel(memberId, startDate, endDate) {
        try {
            const response = await axiosInstance.get(`/reports/member/${memberId}/excel`, {
                params: { startDate, endDate },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `statement_${memberId}_${Date.now()}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadDividendReport(runId) {
        try {
            const response = await axiosInstance.get(`/reports/dividends/${runId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `dividend_report_${runId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadContributionComplianceReport(month, groupId) {
        try {
            const response = await axiosInstance.get(`/reports/compliance`, {
                params: { month, groupId },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `compliance_report_${month}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },


    // ========================================
    // MEMBER MANAGEMENT
    // ========================================

    /**
     * Get all members with their financial summary (Supabase View)
     */
    async getMembers() {
        try {
            const response = await axiosInstance.get('/members');
            const data = response.data;

            return data.map(member => ({
                id: member.id,
                name: member.name || member.full_name,
                phone: member.phone,
                groupId: member.group_id,
                groupName: member.group_name || 'N/A',
                status: member.status,
                savings: member.current_savings || 0,
                activeLoans: member.active_loan_balance || 0,
                arrears: member.arrears || 0,
                guaranteedAmount: member.total_guaranteed_amount || 0,
                // Include original fields for backward compatibility/extra logic
                full_name: member.name || member.full_name,
                current_savings: member.current_savings || 0,
                active_loan_balance: member.active_loan_balance || 0
            }));
        } catch (error) {
            console.error('getMembers error:', error);
            return [];
        }
    },

    /**
     * Get members by group ID
     */
    async getMembersByGroup(groupId) {
        try {
            const response = await axiosInstance.get(`/members?group_id=${groupId}`);
            const data = response.data;

            return data.map(member => ({
                id: member.id,
                name: member.name || member.full_name,
                phone: member.phone,
                groupId: member.group_id,
                groupName: member.group_name || 'N/A',
                status: member.status,
                savings: member.current_savings || 0,
                activeLoans: member.active_loan_balance || 0,
                arrears: member.arrears || 0,
                ltl_bf: 0,
                stl_bf: 0,
                savings_bf: member.current_savings || 0,
                full_name: member.name || member.full_name,
                current_savings: member.current_savings || 0,
                active_loan_balance: member.active_loan_balance || 0
            }));
        } catch (error) {
            console.error('getMembersByGroup error:', error);
            return [];
        }
    },

    /**
     * Get a single member by ID
     */
    async postTransaction(data) {
        try {
            const response = await axiosInstance.post('/transactions', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getMember(id) {
        try {
            const response = await axiosInstance.get(`/members/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Create a new member
     */
    async createMember(memberData) {
        try {
            const response = await axiosInstance.post('/members', memberData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Update member profile
     */
    async updateMember(id, memberData) {
        try {
            const response = await axiosInstance.put(`/members/${id}`, memberData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async deleteMember(id) {
        try {
            const response = await axiosInstance.delete(`/members/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // CONTRIBUTION MANAGEMENT
    // ========================================

    /**
     * Post a new contribution (institutional standard)
     */
    async postContribution(contributionData) {
        try {
            const payload = {
                ...contributionData,
                sessionId: contributionData.meetingId // Map meetingId to sessionId requirement
            };
            const response = await axiosInstance.post('/contributions', payload);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Post a new loan repayment (Supabase Integrated)
     */
    async postRepayment(repaymentData) {
        try {
            const payload = {
                ...repaymentData,
                sessionId: repaymentData.meetingId || repaymentData.sessionId
            };
            const response = await axiosInstance.post('/sessions/repayment', payload);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async postWithdrawal(withdrawalData) {
        try {
            const payload = {
                ...withdrawalData,
                sessionId: withdrawalData.meetingId || withdrawalData.sessionId
            };
            const response = await axiosInstance.post('/withdrawals', payload);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Get contribution compliance data for a period (Institutional)
     */
    /**
     * Get contribution compliance data for a period (Institutional)
     */
    async getContributionCompliance(month, groupId = 'all') {
        try {
            const response = await axiosInstance.get(`/reports/contribution-compliance?month=${month}&groupId=${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
            return [];
        }
    },

    // ========================================
    // LOAN MANAGEMENT
    // ========================================

    /**
     * Issue a new loan (Supabase Integrated)
     */
    async issueLoan(loanData) {
        try {
            const response = await axiosInstance.post('/loans', loanData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Get loans (Supabase Integrated)
     */
    async getLoans(memberId = null) {
        try {
            const url = memberId ? `/loans?memberId=${memberId}` : '/loans';
            const response = await axiosInstance.get(url);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanSchedule(loanId) {
        try {
            const response = await axiosInstance.get(`/loans/${loanId}/schedule`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Get loan repayment tracking data
     */
    /**
     * Get loan repayment tracking data (Institutional Standard)
     */


    async getSMSLogs() {
        try {
            const response = await axiosInstance.get('/reports/sms-logs');
            return response.data;
        } catch (error) {
            console.error('getSMSLogs error:', error);
            return [];
        }
    },

    /**
     * Approve or reject a loan
     */
    async approveLoan(loanId, approvalData) {
        try {
            const response = await axiosInstance.put(`/loans/${loanId}`, { status: approvalData.status });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // MEETING MANAGEMENT
    // ========================================

    /**
     * Get active meeting for a group (Supabase Integrated)
     */
    async getActiveMeeting(groupId) {
        try {
            const response = await axiosInstance.get(`/groups/${groupId}/active-session`);
            return response.data;
        } catch (error) {
            console.error('getActiveMeeting error:', error);
            return null;
        }
    },

    /**
     * Get all meeting sessions (for dashboard)
     */
    async getMeetingSessions() {
        try {
            const response = await axiosInstance.get('/sessions');
            return response.data;
        } catch (error) {
            console.error('getMeetingSessions error:', error);
            return [];
        }
    },

    /**
     * Create a new meeting session
     */
    async createMeeting(meetingData) {
        try {
            const response = await axiosInstance.post('/sessions', meetingData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateMeeting(meetingId, meetingData) {
        try {
            const response = await axiosInstance.patch(`/sessions/${meetingId}`, meetingData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Close a meeting session
     */
    async closeMeeting(meetingId, closureData) {
        try {
            const response = await axiosInstance.patch(`/sessions/${meetingId}/close`, closureData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async postMeeting(meetingId, postData) {
        try {
            const response = await axiosInstance.post(`/sessions/${meetingId}/post`, postData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // TRANSACTION MANAGEMENT
    // ========================================

    /**
     * Reverse a transaction (Full Institutional Audit Trail)
     */
    async reverseTransaction(transactionId, reason, approverId) {
        try {
            const response = await axiosInstance.post(`/transactions/${transactionId}/reverse`, { reason, approverId });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },


    // Transaction methods are at the end

    // ========================================
    // GROUP MANAGEMENT
    // ========================================


    // Group methods are at the end

    async deleteGroup(id) {
        try {
            const response = await axiosInstance.delete(`/groups/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async createGroup(groupData) {
        try {
            const response = await axiosInstance.post('/groups', groupData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateGroup(id, groupData) {
        try {
            const response = await axiosInstance.put(`/groups/${id}`, groupData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getGroupTransactions(groupId) {
        try {
            const response = await axiosInstance.get(`/groups/${groupId}/transactions`);
            return response.data;
        } catch (error) {
            console.error('getGroupTransactions error:', error);
            return [];
        }
    },

    // ========================================
    // ADMIN & SYSTEM MANAGEMENT
    // ========================================

    async getAuditLogs(limit = 50, offset = 0) {
        try {
            const response = await axiosInstance.get(`/admin/audit-logs?limit=${limit}&offset=${offset}`);
            return response.data;
        } catch (error) {
            console.error('getAuditLogs error:', error);
            return [];
        }
    },

    async getAdminSettings() {
        try {
            const response = await axiosInstance.get('/admin/settings');
            return response.data;
        } catch (error) {
            console.error('getAdminSettings error:', error);
            return [];
        }
    },

    async saveAdminSetting(setting) {
        try {
            const response = await axiosInstance.post('/admin/settings', setting);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanProducts() {
        try {
            const response = await axiosInstance.get('/loan-products');
            return response.data;
        } catch (error) {
            console.error('getLoanProducts error:', error);
            return [];
        }
    },

    async saveLoanProduct(product) {
        try {
            const response = await axiosInstance.post('/loan-products', product);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async deleteLoanProduct(id) {
        try {
            const response = await axiosInstance.delete(`/loan-products/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DIVIDEND ENGINE
    // ========================================



    async previewDividends(params) {
        try {
            const response = await axiosInstance.post('/dividends/preview', params);
            return response.data;
        } catch (error) {
            // Let the caller handle this specific error for UI feedback
            throw error;
        }
    },

    async postDividends(data) {
        try {
            const response = await axiosInstance.post('/dividends/post', data);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    async downloadBackup() {
        alert("Please use the Supabase Dashboard to download database backups.");
    },

    async downloadTableExport(table) {
        toast.info("Exporting CSV via local API...");
        try {
            const response = await axiosInstance.get(`/admin/export?table=${table}`);
            const data = response.data;

            if (!data || data.length === 0) {
                toast.info('No data to export');
                return;
            }

            const headers = Object.keys(data[0]);
            const csvRows = [
                headers.join(','),
                ...data.map(row => headers.map(fieldName => {
                    const val = row[fieldName];
                    return JSON.stringify(val === null ? '' : val);
                }).join(','))
            ];
            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${table}_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // OFFICER MANAGEMENT (Supabase Integrated)
    // ========================================
    async getOfficers() {
        try {
            const response = await axiosInstance.get('/officers');
            return response.data;
        } catch (error) {
            console.error('getOfficers error:', error);
            return [];
        }
    },

    async getProfile(userId) {
        try {
            const response = await axiosInstance.get(`/profile${userId ? `?id=${userId}` : ''}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateProfile(updates) {
        try {
            const response = await axiosInstance.put('/profile', updates);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async saveOfficer(officer) {
        try {
            const response = await axiosInstance.post('/officers', officer);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async deleteOfficer(id) {
        try {
            const response = await axiosInstance.delete(`/officers/${id}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateOfficerStatus(id, status) {
        try {
            const response = await axiosInstance.put(`/officers/${id}`, { status });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async resetOfficerPassword(email) {
        try {
            const response = await axiosInstance.post(`/officers/reset-password`, { email });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // HELPER FUNCTIONS
    // ========================================

    async updateMemberSavings(memberId, amount) {
        // No-op: handled by triggers on transactions table
        console.log('updateMemberSavings: Handled by DB triggers');
    },

    async getMemberFinancialSummary(memberId) {
        try {
            const response = await axiosInstance.get(`/members/${memberId}/summary`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DAILY REPORTS
    // ========================================
    // Note: 'daily_cash_reports' table not defined in new schema, 
    // replacing with aggregate queries on meeting_sessions/transactions

    async getDailyReports(filters = {}) {
        // Return meeting summaries as daily reports
        return await this.getMeetingSessions();
    },

    async getDailyReportContext(groupId, date) {
        try {
            const response = await axiosInstance.get(`/daily-reports/context/${groupId}/${date}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DIVIDEND ENGINE (Supabase Native)
    // ========================================

    async generateDividendReport(groupId, year) {
        // Fetch raw data for frontend calculation or trigger DB function
        // For now, returning mock structure populated with DB data where possible
        return {
            financials: {
                bankInterest: 0, // Needs manual input or separate table
                stlInterest: 0,
                ltlInterest: 0,
                total_income: 0
            },
            members: [] // Populate via getMembers() in UI
        };
    },

    async getDividendRuns(financialYear = null) {
        return [];
    },

    async createDividendRun(runData) {
        return { success: true };
    },

    async updateDividendRun(runId, updates) {
        return { success: true };
    },


    async getDividendAllocations(runId) {
        return [];
    },

    // ========================================
    // LOAN REPAYMENT TRACKING
    // ========================================

    async getLoanRepaymentTracking(month) {
        try {
            const response = await axiosInstance.get(`/reports/loan-tracking?month=${month}`);
            return response.data;
        } catch (error) {
            console.error('getLoanRepaymentTracking error:', error);
            // Return empty list on error to prevent UI crash
            return [];
        }
    },

    async downloadLoanRepaymentReport(month, group, type) {
        try {
            const response = await axiosInstance.get(`/reports/loan-repayment-pdf?month=${month}&groupId=${group}&type=${type}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Loan_Repayment_Report_${month}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async postDividendRun(runId) {
        return { success: true };
    },

    // ========================================
    // LOAN WORKFLOW (Supabase)
    // ========================================

    async submitLoanApplication(applicationData) {
        try {
            const response = await axiosInstance.post('/loan-applications', applicationData);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getLoanApplications(status = 'ALL') {
        try {
            const response = await axiosInstance.get('/loan-applications', {
                params: { status }
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async updateApplicationStatus(id, status, comments, officerId, role) {
        try {
            const response = await axiosInstance.patch(`/loan-applications/${id}/status`, {
                status,
                comments,
                officerId,
                role
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadMeetingMinutes(sessionId) {
        try {
            const response = await axiosInstance.get(`/reports/meeting/${sessionId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Meeting_Minutes_${sessionId}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // LOAN PRODUCTS - HELPERS
    // ========================================

    async getLoanProductByAmount(amount) {
        return null;
    },

    async findClosestLoanProduct(desiredAmount) {
        return null;
    }
    ,

    // ==========================================
    // FINANCIAL REPORTS (Standardized)
    // ==========================================
    async getBalanceSheet(date) {
        try {
            const response = await axiosInstance.get('/reports/financial/balance-sheet', { params: { date } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getIncomeStatement(startDate, endDate) {
        try {
            const response = await axiosInstance.get('/reports/financial/income-statement', { params: { startDate, endDate } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getDailyCashFlow(date) {
        try {
            const response = await axiosInstance.get('/reports/financial/daily-cash-flow', { params: { date } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ==========================================
    // PARTNERSHIP MODEL (Commitments/Top-Ups)
    // ==========================================
    async addCompanyTopUp(data) {
        try {
            const response = await axiosInstance.post('/partnership/top-up', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async addCommitmentDeposit(data) {
        try {
            const response = await axiosInstance.post('/partnership/commitment-deposit', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async issueProduct(data) {
        try {
            const response = await axiosInstance.post('/partnership/issue-product', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getPartnershipExposure(groupId) {
        try {
            const response = await axiosInstance.get(`/partnership/exposure/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async applyPartnerOffset(data) {
        try {
            const response = await axiosInstance.post('/partnership/apply-offset', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadPartnershipStatement(groupId) {
        try {
            const response = await axiosInstance.get(`/reports/partnership/${groupId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Partnership_Statement_${groupId}_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async getRelationshipScore(groupId) {
        try {
            const response = await axiosInstance.get(`/partnership/score/${groupId}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // PROJECT SAVINGS MODULE
    // ========================================

    async registerProject(memberId, projectType, groupId) {
        try {
            const response = await axiosInstance.post('/projects/register', {
                member_id: memberId,
                project_type: projectType,
                groupId: groupId
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async postProjectSaving(registrationId, amount, date, groupId) {
        try {
            const response = await axiosInstance.post('/projects/save', {
                registration_id: registrationId,
                amount,
                date,
                groupId: groupId
            });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getProjectGroupStats(groupId) {
        try {
            const response = await axiosInstance.get(`/projects/group-stats/${groupId}`);
            return response.data;
        } catch (error) {
            console.error('getProjectGroupStats error:', error);
            return {
                pools: [],
                total_project_pool: 0,
                total_table_savings: 0,
                total_active_loans: 0,
                payout_obligation: 0,
                available_cash: 0,
                liquidity_alert: 'SAFE',
                participation_rate: 0,
                loan_utilization: 0,
                education_pool: 0,
                agriculture_pool: 0
            };
        }
    },

    async postProjectPayout(registrationId) {
        try {
            const response = await axiosInstance.post('/projects/payout', { registration_id: registrationId });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getProjectMemberStatus(memberId) {
        try {
            const response = await axiosInstance.get(`/projects/member-status/${memberId}`);
            return response.data;
        } catch (error) {
            console.error('getProjectMemberStatus error:', error);
            return [];
        }
    },

    async getProjectMemberDayLimit(memberId, date) {
        try {
            const formattedDate = date || new Date().toISOString().split('T')[0];
            const response = await axiosInstance.get(`/projects/member-day-limit/${memberId}/${formattedDate}`);
            return response.data;
        } catch (error) {
            console.error('getProjectMemberDayLimit error:', error);
            return { daily_limit: 0, already_saved: 0, remaining_limit: 0 };
        }
    },

    async getProjectGroupMatrix(groupId) {
        try {
            const response = await axiosInstance.get(`/projects/group-matrix/${groupId}`);
            return response.data;
        } catch (error) {
            console.error('getProjectGroupMatrix error:', error);
            return [];
        }
    },

    // ========================================
    // GOVERNANCE & MESSAGING (New)
    // ========================================

    async getOfficials() {
        try {
            const response = await axiosInstance.get('/officials');
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async sendBulkNotification(data) {
        try {
            const response = await axiosInstance.post('/notifications/bulk', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getOfficerPerformance() {
        try {
            const response = await axiosInstance.get('/reports/officer-performance');
            return response.data;
        } catch (error) {
            handleApiError(error);
            return [];
        }
    },

    async getNotificationLogs(limit = 100) {
        try {
            const response = await axiosInstance.get('/notifications/logs', { params: { limit } });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // PROJECT MANAGEMENT
    // ========================================

    async getProjectMemberStatus(memberId) {
        try {
            const response = await axiosInstance.get(`/projects/member/${memberId}/status`);
            return response.data;
        } catch (error) {
            console.error('getProjectMemberStatus error:', error);
            return [];
        }
    },

    async getProjectMemberDayLimit(memberId) {
        try {
            const response = await axiosInstance.get(`/projects/member/${memberId}/daily-limit`);
            return response.data;
        } catch (error) {
            console.error('getProjectMemberDayLimit error:', error);
            return { remaining_limit: 0, daily_savings: 0 };
        }
    },

    async postProjectSaving(registrationId, amount, date, groupId) {
        try {
            const payload = { amount, date, groupId };
            const response = await axiosInstance.post(`/projects/savings/${registrationId}`, payload);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // DEFINITIVE OVERRIDES (Resolves Duplicate Chaos)
    // ========================================

    async getMember(id) {
        const response = await axiosInstance.get(`/members/${id}`);
        return response.data;
    },

    async getGroup(id) {
        const response = await axiosInstance.get(`/groups/${id}`);
        return response.data;
    },

    async getGroups() {
        const response = await axiosInstance.get('/groups');
        return response.data;
    },

    async getMembers(groupId = null) {
        const params = groupId ? { groupId } : {};
        const response = await axiosInstance.get('/members', { params });
        return response.data;
    },

    async getMembersByGroup(groupId) {
        return this.getMembers(groupId);
    },

    async getLoans(memberId = null) {
        const params = memberId ? { memberId } : {};
        const response = await axiosInstance.get('/loans', { params });
        // Map backend fields to frontend expectations
        return (response.data || []).map(loan => ({
            ...loan,
            date_issued: loan.issued_date || loan.created_at,
            principal_amount: parseFloat(loan.principal_amount || 0),
            interest_rate: parseFloat(loan.interest_rate || 0),
            status: loan.status ? loan.status.charAt(0).toUpperCase() + loan.status.slice(1).toLowerCase() : 'Active'
        }));
    },

    async getLatestCashSession(groupId) {
        const response = await axiosInstance.get(`/sessions/latest`, { params: { groupId } });
        return response.data;
    },

    async postContribution(data) {
        // Ensure sessionId is preserved and amount is mapped if needed for legacy compatibility
        const payload = {
            ...data,
            amount: data.amount || (parseFloat(data.savings || 0) + parseFloat(data.welfare || 0) + parseFloat(data.project || 0) + parseFloat(data.penalty || 0))
        };
        const response = await axiosInstance.post('/contributions/post', payload);
        return response.data;
    },

    async postWithdrawal(data) {
        const response = await axiosInstance.post('/withdrawals/post', data);
        return response.data;
    },

    async processLoanRepayment(data) {
        const response = await axiosInstance.post('/loans/repay', data);
        return response.data;
    },

    async previewTransaction(data) {
        try {
            const response = await axiosInstance.post('/transactions/preview', data);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async postTransaction(data) {
        try {
            // Unified MTE Payload
            const payload = {
                memberId: data.memberId,
                sessionId: data.sessionId || data.meetingId,
                transaction_type: data.type || data.finalType,
                amount: parseFloat(data.amount),
                description: data.description || '',
                officerId: data.officerId,
                breakdown: data.breakdown
            };

            const response = await axiosInstance.post('/transactions/post', payload);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    async getTransactions(memberId = null, filters = {}) {
        const params = { ...filters };
        if (memberId) params.memberId = memberId;
        const response = await axiosInstance.get('/transactions', { params });
        // Map backend fields to frontend expectations for Member Profile
        return (response.data || []).map(t => {
            // Normalize transaction type for UI filters (e.g., SAVINGS -> Savings)
            let type = t.transaction_type || 'Savings';
            if (type.toUpperCase() === 'SAVINGS') type = 'Savings';
            else if (type.toUpperCase() === 'WITHDRAWAL') type = 'Withdrawal';
            else if (type.toUpperCase() === 'LOANREPAYMENT') type = 'LoanRepayment';
            else if (type.toUpperCase() === 'FINE') type = 'Fine';
            else type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();

            return {
                ...t,
                date: t.sessionDate || t.created_at,
                type: type,
                amount: parseFloat(t.savings_amount || 0) - parseFloat(t.withdrawals || 0) + parseFloat(t.stl_repayment || 0) + parseFloat(t.ltl_repayment || 0) + parseFloat(t.loan_interest || 0) + parseFloat(t.fines || 0)
            };
        });
    }
};

export default api;
