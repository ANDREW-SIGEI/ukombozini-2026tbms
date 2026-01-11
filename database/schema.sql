-- ============================================
-- UKOMBOZI TBMS - DATABASE SCHEMA
-- Phase 1: Foundation Schema
-- ============================================

-- ============================================
-- 1. CORE TABLES: Users, Roles, Permissions
-- ============================================

-- Roles Table
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
('Director', 'Absolute control - can perform all actions'),
('Admin', 'System management - can manage users and rules'),
('Supervisor', 'Approval & oversight - can approve loans and reports'),
('FieldOfficer', 'Data entry only - can post contributions and submit reports');

-- Permissions Table
CREATE TABLE permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert core permissions
INSERT INTO permissions (key, description) VALUES
('create_user', 'Create new system users'),
('edit_user', 'Edit existing users'),
('delete_user', 'Delete users'),
('approve_loan', 'Approve loan applications'),
('reverse_transaction', 'Reverse financial transactions'),
('edit_system_rules', 'Modify system configuration rules'),
('submit_cash_report', 'Submit daily cash reports'),
('approve_cash_report', 'Approve daily cash reports'),
('unlock_cash_report', 'Unlock locked cash reports'),
('view_audit_logs', 'View system audit logs'),
('export_data', 'Export system data'),
('backup_restore', 'Perform backup and restore operations'),
('post_contribution', 'Post member contributions'),
('issue_loan', 'Issue loans to members');

-- Role-Permission Mapping Table
CREATE TABLE role_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (role_id, permission_id)
);

-- Users Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role_id INT NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ============================================
-- 2. FINANCIAL CONFIGURATION TABLES
-- ============================================

-- System Settings Table (Key-Value Store)
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Insert default system settings
INSERT INTO system_settings (key, value, data_type, description) VALUES
-- Contribution Rules
('contribution_min_amount', '500', 'number', 'Minimum contribution amount in KES'),
('contribution_max_missed_meetings', '3', 'number', 'Maximum missed meetings before penalty'),
('contribution_auto_penalty', 'true', 'boolean', 'Enable automatic penalty for late contributions'),
('contribution_penalty_amount', '100', 'number', 'Penalty amount in KES for late contributions'),

-- Loan Rules
('loan_max_multiplier', '3', 'number', 'Maximum loan multiplier (e.g., 3x means 3× savings)'),
('loan_interest_rate', '10', 'number', 'Default interest rate percentage'),
('loan_grace_period_days', '7', 'number', 'Grace period in days before penalties apply'),
('loan_penalty_per_day', '50', 'number', 'Penalty amount per day after grace period'),
('loan_min_amount', '1000', 'number', 'Minimum loan amount in KES'),
('loan_max_amount', '500000', 'number', 'Maximum loan amount in KES'),

-- Group Rules
('group_max_members', '30', 'number', 'Maximum members allowed per group'),
('group_loan_ceiling', '2000000', 'number', 'Maximum total loans per group in KES'),
('group_suspension_threshold', '5', 'number', 'Missed meetings before group suspension'),

-- Financial Settings
('currency', 'KES', 'string', 'System currency code'),
('interest_calculation_method', 'simple', 'string', 'Interest calculation method (simple/compound)'),
('dividend_formula', 'proportional', 'string', 'Dividend calculation formula (proportional/equal/weighted)'),
('rounding_method', 'nearest', 'string', 'Rounding method (nearest/up/down/none)'),
('financial_year_start', '01-01', 'string', 'Financial year start date (MM-DD)'),
('financial_year_end', '12-31', 'string', 'Financial year end date (MM-DD)'),

-- Daily Cash Report Rules
('report_block_next_day_access', 'true', 'boolean', 'Block system access if previous day report missing'),
('report_block_loan_if_unbalanced', 'true', 'boolean', 'Block loan approval if cash report unbalanced'),
('report_auto_lock_after_submission', 'true', 'boolean', 'Auto-lock report after submission'),
('report_require_variance_explanation', 'true', 'boolean', 'Require explanation if variance ≠ 0'),
('report_admin_only_unlock', 'true', 'boolean', 'Only admins can unlock locked reports');

-- ============================================
-- 3. TRANSACTIONS & CONTROL TABLES
-- ============================================

-- Groups Table
CREATE TABLE groups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    opening_balance DECIMAL(15, 2) DEFAULT 0,
    status ENUM('active', 'suspended', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Members Table
CREATE TABLE members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    group_id INT NOT NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    total_contributions DECIMAL(15, 2) DEFAULT 0,
    total_loans DECIMAL(15, 2) DEFAULT 0,
    balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id)
);

-- Contributions Table
CREATE TABLE contributions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    group_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(50) DEFAULT 'Monthly Saving',
    date DATE NOT NULL,
    officer_id INT NOT NULL,
    reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (officer_id) REFERENCES users(id)
);

-- Loans Table
CREATE TABLE loans (
    id VARCHAR(50) PRIMARY KEY,
    member_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    interest_rate DECIMAL(5, 2) NOT NULL,
    interest_amount DECIMAL(15, 2) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    status ENUM('pending', 'approved', 'active', 'overdue', 'defaulted', 'paid') DEFAULT 'pending',
    due_date DATE,
    grace_period_end DATE,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    issued_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);

-- Loan Repayments Table
CREATE TABLE loan_repayments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    loan_id VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    principal DECIMAL(15, 2) NOT NULL,
    interest DECIMAL(15, 2) NOT NULL,
    penalty DECIMAL(15, 2) DEFAULT 0,
    payment_date DATE NOT NULL,
    officer_id INT NOT NULL,
    reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES loans(id),
    FOREIGN KEY (officer_id) REFERENCES users(id)
);

-- Daily Cash Reports Table
CREATE TABLE daily_cash_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    officer_id INT NOT NULL,
    group_id INT NOT NULL,
    date DATE NOT NULL,
    opening_balance DECIMAL(15, 2) NOT NULL,
    cash_collected DECIMAL(15, 2) DEFAULT 0,
    cash_issued DECIMAL(15, 2) DEFAULT 0,
    expected_closing DECIMAL(15, 2) NOT NULL,
    actual_closing DECIMAL(15, 2) NOT NULL,
    variance DECIMAL(15, 2) NOT NULL,
    variance_explanation TEXT,
    status ENUM('draft', 'submitted', 'approved', 'locked') DEFAULT 'draft',
    submitted_at TIMESTAMP NULL,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    locked_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (officer_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    UNIQUE KEY unique_officer_group_date (officer_id, group_id, date)
);

-- Dividends Table
CREATE TABLE dividends (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    calculation_period_start DATE NOT NULL,
    calculation_period_end DATE NOT NULL,
    status ENUM('pending', 'paid') DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    reference VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id)
);

-- Ledger Entries Table (Complete Transaction History)
CREATE TABLE ledger_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT,
    group_id INT NOT NULL,
    date DATE NOT NULL,
    description VARCHAR(255) NOT NULL,
    type ENUM('Credit', 'Debit') NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    reference VARCHAR(100),
    related_loan_id VARCHAR(50),
    related_contribution_id INT,
    officer_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (officer_id) REFERENCES users(id),
    FOREIGN KEY (related_loan_id) REFERENCES loans(id),
    FOREIGN KEY (related_contribution_id) REFERENCES contributions(id)
);

-- ============================================
-- 4. AUDIT & LOGGING TABLES
-- ============================================

-- Audit Logs Table
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_timestamp (timestamp)
);

-- ============================================
-- 5. BACKUP & SYSTEM TABLES
-- ============================================

-- Backup Logs Table
CREATE TABLE backup_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    backup_type ENUM('manual', 'scheduled', 'restore') NOT NULL,
    status ENUM('success', 'failed', 'in_progress') NOT NULL,
    file_path VARCHAR(500),
    file_size BIGINT,
    started_by INT NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    error_message TEXT,
    FOREIGN KEY (started_by) REFERENCES users(id)
);

-- ============================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_members_group ON members(group_id);
CREATE INDEX idx_contributions_member ON contributions(member_id);
CREATE INDEX idx_contributions_date ON contributions(date);
CREATE INDEX idx_loans_member ON loans(member_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_daily_reports_date ON daily_cash_reports(date);
CREATE INDEX idx_daily_reports_status ON daily_cash_reports(status);
CREATE INDEX idx_ledger_member ON ledger_entries(member_id);
CREATE INDEX idx_ledger_date ON ledger_entries(date);

-- ============================================
-- 7. DEFAULT ROLE PERMISSIONS MAPPING
-- ============================================

-- Director: All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Admin: Most permissions except backup/restore
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE key != 'backup_restore';

-- Supervisor: Approval and oversight permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE key IN (
    'approve_loan',
    'approve_cash_report',
    'submit_cash_report',
    'export_data',
    'view_audit_logs'
);

-- Field Officer: Data entry only
INSERT INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions WHERE key IN (
    'post_contribution',
    'submit_cash_report'
);

