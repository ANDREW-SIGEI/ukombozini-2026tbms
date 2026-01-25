import axios from 'axios';
import { toast } from 'react-toastify';
import NotificationService from './NotificationService';

/**
 * UKOMBOZI Table Banking System - API Service
 * Decoupled from Supabase, now using Local Node.js / SQLite backend.
 */

const API_URL = 'http://localhost:5000/api';

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

    async downloadMeetingMinutes(sessionId) {
        try {
            const response = await axiosInstance.get(`/reports/meeting/${sessionId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `meeting_minutes_${sessionId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            handleApiError(error);
        }
    },

    async downloadMemberStatement(memberId, startDate, endDate) {
        try {
            const response = await axiosInstance.get(`/reports/member/${memberId}`, {
                params: { startDate, endDate },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `member_statement_${memberId}.pdf`);
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

    async downloadLoanRepaymentReport(month, groupId, type) {
        try {
            const response = await axiosInstance.get(`/reports/loan-repayments`, {
                params: { month, groupId, type },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `loan_repayment_report_${month}.pdf`);
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

    // ========================================
    // CONTRIBUTION MANAGEMENT
    // ========================================

    /**
     * Post a new contribution (institutional standard)
     */
    async postContribution(contributionData) {
        try {
            const response = await axiosInstance.post('/transactions', contributionData);
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
            const response = await axiosInstance.post('/transactions', { ...repaymentData, type: 'loan_repayment' });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Post a withdrawal (Supabase Integrated)
     */
    async postWithdrawal(withdrawalData) {
        try {
            const response = await axiosInstance.post('/transactions', { ...withdrawalData, type: 'withdrawal' });
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    /**
     * Get contribution compliance data for a period (Institutional)
     */
    async getContributionCompliance(month, groupId = 'all') {
        try {
            // 1. Fetch relevant members
            const members = await this.getMembers();
            const filteredMembers = groupId === 'all' ? members : members.filter(m => m.groupId.toString() === groupId.toString());

            // 2. Fetch savings transactions for the month
            const startDate = `${month}-01`;
            const endDate = `${month}-31`;
            const transactions = await this.getTransactions(null, { type: 'savings', startDate, endDate });

            // 3. Aggregate
            const memberSavings = {};
            transactions.forEach(t => {
                memberSavings[t.memberId] = (memberSavings[t.memberId] || 0) + Number(t.amount);
            });

            const expectation = 2000;
            return filteredMembers.map(m => {
                const paid = memberSavings[m.id] || 0;
                let status = 'Skipped';
                if (paid >= expectation) status = 'Paid';
                else if (paid > 0) status = 'Partial';

                return {
                    id: m.id,
                    name: m.name,
                    phone: m.phone,
                    groupId: m.groupId,
                    groupName: m.groupName,
                    contributionAmount: paid,
                    contributionStatus: status,
                    expectedAmount: expectation,
                    shortfall: Math.max(0, expectation - paid)
                };
            });
        } catch (error) {
            handleApiError(error);
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

    /**
     * Get loan repayment tracking data
     */
    /**
     * Get loan repayment tracking data (Institutional Standard)
     */
    async getLoanRepaymentTracking(month) {
        try {
            const response = await axiosInstance.get(`/admin/loan-repayment-tracking?month=${month}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
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

    /**
     * Close a meeting session
     */
    async closeMeeting(meetingId, closureData) {
        try {
            const response = await axiosInstance.put(`/sessions/${meetingId}/close`, closureData);
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

    /**
     * Get transactions for a member
     */
    async getTransactions(memberId = null, filters = {}) {
        try {
            const params = new URLSearchParams(filters);
            if (memberId) params.append('memberId', memberId);
            const response = await axiosInstance.get(`/transactions?${params.toString()}`);
            return response.data;
        } catch (error) {
            handleApiError(error);
        }
    },

    // ========================================
    // GROUP MANAGEMENT
    // ========================================

    // GROUPS (Supabase Integrated)
    async getGroups() {
        try {
            const response = await axiosInstance.get('/groups');
            return response.data.map(g => ({
                ...g,
                group_name: g.name // Map 'name' from SQLite to 'group_name' used in UI
            }));
        } catch (error) {
            console.error('getGroups error:', error);
            return [];
        }
    },

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
            const response = await axiosInstance.get(`/reports/meeting-minutes/${sessionId}`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Meeting_Minutes_${sessionId}.pdf`);
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
};

export default api;
