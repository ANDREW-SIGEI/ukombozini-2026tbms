/**
 * Permission Utilities
 * Phase 2: Role & Permission Logic
 * 
 * Centralized permission checking and role-based access control
 */

// Permission Keys (must match database)
export const PERMISSIONS = {
    CREATE_USER: 'create_user',
    EDIT_USER: 'edit_user',
    DELETE_USER: 'delete_user',
    APPROVE_LOAN: 'approve_loan',
    REVERSE_TRANSACTION: 'reverse_transaction',
    EDIT_SYSTEM_RULES: 'edit_system_rules',
    SUBMIT_CASH_REPORT: 'submit_cash_report',
    APPROVE_CASH_REPORT: 'approve_cash_report',
    UNLOCK_CASH_REPORT: 'unlock_cash_report',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    EXPORT_DATA: 'export_data',
    BACKUP_RESTORE: 'backup_restore',
    POST_CONTRIBUTION: 'post_contribution',
    ISSUE_LOAN: 'issue_loan',
};

// Role Definitions
export const ROLES = {
    DIRECTOR: 'Director',
    ADMIN: 'Admin',
    SUPERVISOR: 'Supervisor',
    FIELD_OFFICER: 'FieldOfficer',
};

/**
 * Check if user has specific permission
 * @param {Array} userPermissions - Array of permission keys
 * @param {string} permissionKey - Permission to check
 * @returns {boolean}
 */
export const hasPermission = (userPermissions, permissionKey) => {
    if (!userPermissions || !Array.isArray(userPermissions)) return false;
    return userPermissions.includes(permissionKey);
};

/**
 * Check if user has any of the specified permissions
 * @param {Array} userPermissions - Array of permission keys
 * @param {Array} permissionKeys - Array of permissions to check
 * @returns {boolean}
 */
export const hasAnyPermission = (userPermissions, permissionKeys) => {
    return permissionKeys.some(key => hasPermission(userPermissions, key));
};

/**
 * Check if user has all specified permissions
 * @param {Array} userPermissions - Array of permission keys
 * @param {Array} permissionKeys - Array of permissions to check
 * @returns {boolean}
 */
export const hasAllPermissions = (userPermissions, permissionKeys) => {
    return permissionKeys.every(key => hasPermission(userPermissions, key));
};

/**
 * Check if user can edit system settings
 * @param {string} userRole - User's role
 * @returns {boolean}
 */
export const canEditSettings = (userRole) => {
    return userRole === ROLES.DIRECTOR || userRole === ROLES.ADMIN;
};

/**
 * Check if user can approve loans
 * @param {string} userRole - User's role
 * @returns {boolean}
 */
export const canApproveLoans = (userRole) => {
    return [ROLES.DIRECTOR, ROLES.ADMIN, ROLES.SUPERVISOR].includes(userRole);
};

/**
 * Check if user can unlock reports
 * @param {string} userRole - User's role
 * @returns {boolean}
 */
export const canUnlockReports = (userRole) => {
    return userRole === ROLES.DIRECTOR || userRole === ROLES.ADMIN;
};

/**
 * Check if user can perform backup/restore
 * @param {string} userRole - User's role
 * @returns {boolean}
 */
export const canBackupRestore = (userRole) => {
    return userRole === ROLES.DIRECTOR;
};

/**
 * Log permission violation attempt
 * @param {Object} user - User object
 * @param {string} action - Action attempted
 * @param {string} reason - Reason for denial
 */
export const logPermissionViolation = (user, action, reason) => {
    // In production, send to audit log API
    console.warn('Permission Violation:', {
        user: user?.name || 'Unknown',
        role: user?.role || 'Unknown',
        action,
        reason,
        timestamp: new Date().toISOString(),
    });
    
    // TODO: Send to audit log API
    // auditLogService.log({
    //     user_id: user.id,
    //     action: 'PERMISSION_VIOLATION',
    //     details: { attempted_action: action, reason },
    // });
};

/**
 * Middleware function to block unauthorized actions
 * @param {Object} user - User object
 * @param {string} requiredPermission - Required permission key
 * @param {string} actionName - Name of action for logging
 * @returns {Object} { allowed: boolean, reason?: string }
 */
export const checkPermission = (user, requiredPermission, actionName = 'action') => {
    if (!user) {
        return {
            allowed: false,
            reason: 'User not authenticated',
        };
    }

    if (!hasPermission(user.permissions, requiredPermission)) {
        logPermissionViolation(user, actionName, `Missing permission: ${requiredPermission}`);
        return {
            allowed: false,
            reason: `You do not have permission to ${actionName}. Required: ${requiredPermission}`,
        };
    }

    return {
        allowed: true,
    };
};

