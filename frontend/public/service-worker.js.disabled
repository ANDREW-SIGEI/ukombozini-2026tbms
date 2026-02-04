/**
 * UKOMBOZI Service Worker
 * Progressive Web App - Offline First
 * 
 * Caches app shell and enables offline functionality
 */

const CACHE_NAME = 'ukombozi-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/static/css/main.css',
    '/static/js/main.js',
    '/static/js/bundle.js',
    '/manifest.json',
    '/logo192.png',
    '/logo512.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Service Worker: Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ Service Worker: Installed successfully');
                return self.skipWaiting();
            })
    );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker: Activated');
            return self.clients.claim();
        })
    );
});

// Fetch Strategy: Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Clone response for caching
                const responseToCache = response.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then((response) => {
                    if (response) {
                        console.log('📡 Service Worker: Serving from cache:', event.request.url);
                        return response;
                    }

                    // Return offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                });
            })
    );
});

// Background Sync for offline transactions
self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Background sync triggered');

    if (event.tag === 'sync-transactions') {
        event.waitUntil(syncTransactions());
    }
});

/**
 * Sync offline transactions
 */
async function syncTransactions() {
    try {
        // This will be called by OfflineManager
        console.log('🔄 Service Worker: Syncing offline transactions...');

        // Notify all clients to sync
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_TRANSACTIONS'
            });
        });

        return Promise.resolve();
    } catch (error) {
        console.error('❌ Service Worker: Sync failed:', error);
        return Promise.reject(error);
    }
}

// Push Notifications (Future feature)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};

    const options = {
        body: data.body || 'New notification from UKOMBOZI',
        icon: '/logo192.png',
        badge: '/logo192.png',
        vibrate: [200, 100, 200],
        data: data
    };

    event.waitUntil(
        self.registration.showNotification(
            data.title || 'UKOMBOZI',
            options
        )
    );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.openWindow(event.notification.data.url || '/')
    );
});

console.log('🎉 Service Worker: Loaded');
