/**
 * UKOMBOZI Offline Manager - PWA Service
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
        this.dbName = 'ukombozi_offline';
        this.dbVersion = 1;
        this.db = null;
        this.syncQueue = [];
        this.isOnline = navigator.onLine;

        this.init();
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
        const tx = this.db.transaction(['pendingTransactions'], 'readwrite');
        const store = tx.objectStore('pendingTransactions');

        const offlineTransaction = {
            ...transaction,
            timestamp: new Date().toISOString(),
            synced: false,
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
        const tx = this.db.transaction(['pendingTransactions'], 'readonly');
        const store = tx.objectStore('pendingTransactions');
        const index = store.index('synced');

        return new Promise((resolve, reject) => {
            const request = index.getAll(false); // Get all unsynced
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
                        result = await api.postContribution(transaction.data);
                        break;
                    case 'loan':
                        result = await api.issueLoan(transaction.data);
                        break;
                    default:
                        console.warn('Unknown transaction type:', transaction.type);
                        continue;
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
                data.synced = true;
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

    /**
     * Clear synced transactions (cleanup)
     */
    async clearSyncedTransactions() {
        const tx = this.db.transaction(['pendingTransactions'], 'readwrite');
        const store = tx.objectStore('pendingTransactions');
        const index = store.index('synced');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(true); // true = synced
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
}

// Create singleton instance
const offlineManager = new OfflineManager();

export default offlineManager;
