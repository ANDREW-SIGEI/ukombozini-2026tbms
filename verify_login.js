const API_URL = 'http://127.0.0.1:5000';

console.log('🔍 Starting Comprehensive Backend Diagnostics...');

async function checkEndpoint(name, url, options = {}) {
    const startTime = Date.now();
    try {
        console.log(`[${new Date().toISOString()}] Checking ${name} (${url})...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        console.log(`✅ ${name} Responded in ${duration}ms | Status: ${response.status}`);
        return true;

    } catch (error) {
        const duration = Date.now() - startTime;
        if (error.name === 'AbortError') {
            console.error(`❌ ${name} Timed out after ${duration}ms`);
        } else {
            console.error(`❌ ${name} Error:`, error.message);
        }
        return false;
    }
}

async function runTests() {
    // 1. Check Health (No DB)
    const healthOk = await checkEndpoint('Health Check', `${API_URL}/health`);

    // 2. Check Login (DB Access)
    const loginOk = await checkEndpoint('Login Endpoint', `${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'wrong' })
    });

    console.log('\n📊 DIGANOSIS:');
    if (healthOk && loginOk) {
        console.log('🌟 SYSTEM HEALTHY. Backend is responsive.');
    } else if (healthOk && !loginOk) {
        console.log('⚠️ PARTIAL FAILURE. Node.js is up, but Database is LOCKED/SLOW.');
        console.log('   Action: Improve SQLite concurrency (WAL mode) or reduce write contention.');
    } else {
        console.log('💀 CRITICAL FAILURE. Backend process is FROZEN or UNREACHABLE.');
        console.log('   Action: Restart backend, check for infinite loops or resource exhaustion.');
    }
}

runTests();
