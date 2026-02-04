const { Pool } = require('pg');
const redis = require('redis');

// Professional PostgreSQL Pool setup for UKOMBOZI API
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Redis Client for Locking & Performance
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().catch(err => console.error('Redis Connect Failed:', err));

const convertSql = (sql) => {
    let count = 0;
    return sql.replace(/\?/g, () => `$${++count}`);
};

const db = {
    // db.get(sql, params, callback)
    get: function (sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        pool.query(convertSql(sql), params)
            .then(res => callback(null, res.rows[0]))
            .catch(err => callback(err));
    },

    // db.all(sql, params, callback)
    all: function (sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        pool.query(convertSql(sql), params)
            .then(res => callback(null, res.rows))
            .catch(err => callback(err));
    },

    // db.run(sql, params, callback)
    run: function (sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        let querySql = convertSql(sql);
        const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
        if (isInsert && !sql.toUpperCase().includes('RETURNING')) {
            querySql += ' RETURNING id';
        }

        pool.query(querySql, params)
            .then(res => {
                const context = {
                    lastID: res.rows[0]?.id || null,
                    changes: res.rowCount
                };
                if (callback) callback.call(context, null);
            })
            .catch(err => {
                if (callback) callback(err);
            });
    },

    // 🛡️ Transaction Helpers for MTE
    beginTransaction: async () => {
        const client = await pool.connect();
        await client.query('BEGIN');
        return client;
    },

    commit: async (client) => {
        await client.query('COMMIT');
        client.release();
    },

    rollback: async (client) => {
        await client.query('ROLLBACK');
        client.release();
    },

    // 🔒 Redis Locking Utility
    acquireLock: async (key, ttl = 30000) => {
        const result = await redisClient.set(`lock:${key}`, 'LOCKED', {
            NX: true,
            PX: ttl
        });
        return result === 'OK';
    },

    releaseLock: async (key) => {
        await redisClient.del(`lock:${key}`);
    },

    // db.prepare(sql)
    prepare: function (sql) {
        const querySql = convertSql(sql);
        return {
            run: (params, callback) => {
                let finalSql = querySql;
                const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
                if (isInsert && !sql.toUpperCase().includes('RETURNING')) {
                    finalSql += ' RETURNING id';
                }

                pool.query(finalSql, params)
                    .then(res => {
                        const context = {
                            lastID: res.rows[0]?.id || null,
                            changes: res.rowCount
                        };
                        if (callback) callback.call(context, null);
                    })
                    .catch(err => {
                        if (callback) callback(err);
                    });
            },
            finalize: () => { }
        };
    },

    serialize: function (callback) {
        callback();
    },

    pool: pool,
    redis: redisClient
};

console.log('PostgreSQL & Redis Wrapper (Full Stack) initialized for UKOMBOZI.');

module.exports = db;
