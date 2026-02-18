/**
 * UKOMBOZINI Offline Manager - PWA Service
 * Enables officers to work without internet connection
 * 
 * Features:
 * - Store transactions offline
 * - Auto-sync when connection restored
 * - Conflict resolution
 * - Queue management
 * - Status indicators
 */

class OfflineManager {
    constructor() {
        this.dbName = 'ukombozini_offline';
        this.dbVersion = 1;
        this.db = null;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.isSyncing = false; // Prevent overlapping syncs
    }

    /**
     * Initialize offline database
     */
    async init() {
        await this.openDatabase();
        this.setupEventListeners();

        // Check if there are pending transactions to sync
        if (this.isOnline) {
            await this.syncPendingTransactions();
        }

        // Periodic Sync Loop (Every 30 seconds)
        setInterval(async () => {
            if (this.isOnline && !this.isSyncing) {
                await this.syncPendingTransactions();
            }
        }, 30000);
    }

    /**
     * Open IndexedDB for local storage
     */
    openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Pending transactions store
                if (!db.objectStoreNames.contains('pendingTransactions')) {
                    const store = db.createObjectStore('pendingTransactions', {
                        keyPath: 'localId',
                        autoIncrement: true
                    });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('synced', 'synced', { unique: false });
                }

                // Cached members
                if (!db.objectStoreNames.contains('cachedMembers')) {
                    const memberStore = db.createObjectStore('cachedMembers', {
                        keyPath: 'id'
                    });
                    memberStore.createIndex('groupId', 'groupId', { unique: false });
                }

                // Cached meetings
                if (!db.objectStoreNames.contains('cachedMeetings')) {
                    db.createObjectStore('cachedMeetings', { keyPath: 'id' });
                }

                // Cached loans
                if (!db.objectStoreNames.contains('cachedLoans')) {
                    db.createObjectStore('cachedLoans', { keyPath: 'id' });
                }

                // Cached groups
                if (!db.objectStoreNames.contains('cachedGroups')) {
                    db.createObjectStore('cachedGroups', { keyPath: 'id' });
                }

                // Cached loan products
                if (!db.objectStoreNames.contains('cachedLoanProducts')) {
                    db.createObjectStore('cachedLoanProducts', { keyPath: 'id' });
                }

                // Draft sessions (for auto-save)
                if (!db.objectStoreNames.contains('draftSessions')) {
                    db.createObjectStore('draftSessions', { keyPath: 'groupId' });
                }
            };
        });
    }

    /**
     * Setup online/offline event listeners
     */
    setupEventListeners() {
        window.addEventListener('online', async () => {
            console.log('🟢 Connection restored - Starting sync...');
            this.isOnline = true;
            this.showNotification('Connection restored! Syncing data...', 'success');
            await this.syncPendingTransactions();
        });

        window.addEventListener('offline', () => {
            console.log('🔴 Connection lost - Offline mode enabled');
            this.isOnline = false;
            this.showNotification('⚠️ Offline mode: Changes will sync when connection is restored', 'warning');
        });
    }

    /**
     * Save transaction offline
     */
    async saveOfflineTransaction(transaction) {
        if (!this.db) throw new Error('Database not initialized');
        const tx = this.db.transaction(['pendingTransactions'], 'readwrite');
        const store = tx.objectStore('pendingTransactions');

        const offlineTransaction = {
            ...transaction,
            timestamp: new Date().toISOString(),
            synced: 0, // 0 = false
            attempts: 0,
            createdOffline: true
        };

        return new Promise((resolve, reject) => {
            const request = store.add(offlineTransaction);
            request.onsuccess = () => {
                console.log('💾 Transaction saved offline:', offlineTransaction);
                this.showNotification('✅ Saved offline - Will sync when online', 'info');
                resolve(request.result);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all pending transactions
     */
    async getPendingTransactions() {
        if (!this.db) return []; // Guard: DB not initialized yet
        const tx = this.db.transaction(['pendingTransactions'], 'readonly');
        const store = tx.objectStore('pendingTransactions');
        const index = store.index('synced');

        return new Promise((resolve, reject) => {
            const request = index.getAll(0); // Get all unsynced (0)
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Sync pending transactions to server
     */
    async syncPendingTransactions() {
        if (!this.isOnline) {
            console.log('⚠️ Still offline - Cannot sync');
            return { success: false, reason: 'offline' };
        }

        if (this.isSyncing) {
            console.log('⏳ Sync already in progress...');
            return { success: false, reason: 'syncing' };
        }

        this.isSyncing = true;

        const pending = await this.getPendingTransactions();

        if (pending.length === 0) {
            console.log('✅ No pending transactions to sync');
            return { success: true, synced: 0 };
        }

        console.log(`🔄 Syncing ${pending.length} pending transactions...`);
        this.showNotification(`Syncing ${pending.length} transactions...`, 'info');

        let synced = 0;
        let failed = 0;

        for (const transaction of pending) {
            try {
                // Import API service
                const { default: api } = await import('./api');

                // Sync based on transaction type
                let result;
                switch (transaction.type) {
                    case 'contribution':
                        result = await api.postTransaction({ ...transaction.data, type: 'SAVINGS' });
                        break;
                    case 'stl':
                    case 'ltl':
                        result = await api.issueLoan(transaction.data);
                        break;
                    case 'loan':
                    case 'LOAN_DISBURSEMENT':
                        result = await api.postTransaction({ ...transaction.data, transaction_type: 'LOAN_DISBURSEMENT' });
                        break;
                    case 'withdrawal':
                    case 'WITHDRAWAL':
                        result = await api.postTransaction({ ...transaction.data, transaction_type: 'WITHDRAWAL' });
                        break;
                    case 'repayment':
                    case 'LOAN_REPAYMENT':
                        result = await api.postTransaction({ ...transaction.data, transaction_type: 'LOAN_REPAYMENT' });
                        break;
                    case 'meeting_session':
                        result = await api.createMeeting(transaction.data);
                        break;
                    case 'post_meeting':
                        result = await api.postMeeting(transaction.meetingId, transaction.data);
                        break;
                    default:
                        // Try standard transaction post if type matches MTE expectations
                        result = await api.postTransaction(transaction.data);
                        break;
                }

                // Mark as synced
                await this.markAsSynced(transaction.localId, result.id);
                synced++;
                console.log('✅ Synced:', transaction);


            } catch (error) {
                console.error('❌ Sync failed for transaction:', transaction, error);
                await this.incrementAttempts(transaction.localId);
                failed++;
            }
        }

        this.isSyncing = false;

        const message = `Synced ${synced} transactions${failed > 0 ? `, ${failed} failed` : ''}`;
        this.showNotification(message, failed > 0 ? 'warning' : 'success');

        return { success: true, synced, failed };
    }

    /**
     * Mark transaction as synced
     */
    async markAsSynced(localId, serverId) {
        const tx = this.db.transaction(['pendingTransactions'], 'readwrite');
        const store = tx.objectStore('pendingTransactions');

        return new Promise((resolve, reject) => {
            const request = store.get(localId);
            request.onsuccess = () => {
                const data = request.result;
                data.synced = 1; // 1 = true
                data.syncedAt = new Date().toISOString();
                data.serverId = serverId;

                const updateRequest = store.put(data);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Increment sync attempts
     */
    async incrementAttempts(localId) {
        const tx = this.db.transaction(['pendingTransactions'], 'readwrite');
        const store = tx.objectStore('pendingTransactions');

        return new Promise((resolve, reject) => {
            const request = store.get(localId);
            request.onsuccess = () => {
                const data = request.result;
                data.attempts = (data.attempts || 0) + 1;
                data.lastAttempt = new Date().toISOString();

                const updateRequest = store.put(data);
                updateRequest.onsuccess = () => resolve();
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache members for offline access
     */
    async cacheMembers(members) {
        const tx = this.db.transaction(['cachedMembers'], 'readwrite');
        const store = tx.objectStore('cachedMembers');

        for (const member of members) {
            await new Promise((resolve, reject) => {
                const request = store.put({
                    ...member,
                    cachedAt: new Date().toISOString()
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        console.log(`💾 Cached ${members.length} members for offline use`);
    }

    /**
     * Get cached members
     */
    async getCachedMembers(groupId) {
        const tx = this.db.transaction(['cachedMembers'], 'readonly');
        const store = tx.objectStore('cachedMembers');
        const index = store.index('groupId');

        return new Promise((resolve, reject) => {
            const request = groupId ? index.getAll(groupId) : store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache meeting data
     */
    async cacheMeeting(meeting) {
        const tx = this.db.transaction(['cachedMeetings'], 'readwrite');
        const store = tx.objectStore('cachedMeetings');

        return new Promise((resolve, reject) => {
            const request = store.put({
                ...meeting,
                cachedAt: new Date().toISOString()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get cached meeting
     */
    async getCachedMeeting(meetingId) {
        const tx = this.db.transaction(['cachedMeetings'], 'readonly');
        const store = tx.objectStore('cachedMeetings');

        return new Promise((resolve, reject) => {
            const request = store.get(meetingId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache groups for offline access
     */
    async cacheGroups(groups) {
        const tx = this.db.transaction(['cachedGroups'], 'readwrite');
        const store = tx.objectStore('cachedGroups');

        for (const group of groups) {
            await new Promise((resolve, reject) => {
                const request = store.put({
                    ...group,
                    cachedAt: new Date().toISOString()
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    /**
     * Get cached groups
     */
    async getCachedGroups() {
        const tx = this.db.transaction(['cachedGroups'], 'readonly');
        const store = tx.objectStore('cachedGroups');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cache loan products
     */
    async cacheLoanProducts(products) {
        const tx = this.db.transaction(['cachedLoanProducts'], 'readwrite');
        const store = tx.objectStore('cachedLoanProducts');

        for (const product of products) {
            await new Promise((resolve, reject) => {
                const request = store.put({
                    ...product,
                    cachedAt: new Date().toISOString()
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    /**
     * Get cached loan products
     */
    async getCachedLoanProducts() {
        const tx = this.db.transaction(['cachedLoanProducts'], 'readonly');
        const store = tx.objectStore('cachedLoanProducts');
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all pending transactions from the queue (Manual recovery)
     */
    async clearPendingTransactions() {
        if (!this.db) return;
        const tx = this.db.transaction(['pendingTransactions'], 'readwrite');
        const store = tx.objectStore('pendingTransactions');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => {
                console.log('✅ Offline queue cleared manually.');
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get sync queue
     */
    async getSyncQueue() {
        return await this.getPendingTransactions();
    }

    /**
     * Get sync status
     */
    async getSyncStatus() {
        const pending = await this.getPendingTransactions();
        return {
            isOnline: this.isOnline,
            pendingCount: pending.length,
            lastSync: pending.length > 0 ?
                pending[pending.length - 1].timestamp : null
        };
    }

    updateSyncIndicators(message) {
        this.showNotification(message);
    }

    /**
     * Clear synced transactions (cleanup)
     */
    async clearSyncedTransactions() {
        const tx = this.db.transaction(['pendingTransactions'], 'readwrite');
        const store = tx.objectStore('pendingTransactions');
        const index = store.index('synced');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(1); // 1 = synced
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Emit custom event for UI to handle
        window.dispatchEvent(new CustomEvent('offline-notification', {
            detail: { message, type }
        }));
    }

    /**
     * Force sync now
     */
    async forceSyncNow() {
        if (!this.isOnline) {
            this.showNotification('Cannot sync - No internet connection', 'error');
            return { success: false, reason: 'offline' };
        }

        return await this.syncPendingTransactions();
    }

    /**
     * Save meeting draft
     */
    async saveDraftSession(groupId, data) {
        if (!this.db) return;
        const tx = this.db.transaction(['draftSessions'], 'readwrite');
        const store = tx.objectStore('draftSessions');

        return new Promise((resolve, reject) => {
            const request = store.put({
                groupId,
                data,
                updatedAt: new Date().toISOString()
            });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get meeting draft
     */
    async getDraftSession(groupId) {
        if (!this.db) return null;
        const tx = this.db.transaction(['draftSessions'], 'readonly');
        const store = tx.objectStore('draftSessions');

        return new Promise((resolve, reject) => {
            const request = store.get(groupId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear meeting draft
     */
    async clearDraftSession(groupId) {
        if (!this.db) return;
        const tx = this.db.transaction(['draftSessions'], 'readwrite');
        const store = tx.objectStore('draftSessions');

        return new Promise((resolve, reject) => {
            const request = store.delete(groupId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Create singleton instance
const offlineManager = new OfflineManager();

export default offlineManager;
