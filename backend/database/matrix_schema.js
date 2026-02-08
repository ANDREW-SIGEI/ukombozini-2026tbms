/**
 * UKOMBOZI Institutional - Partnership Matrix Schema
 * Defines tiers for dynamic risk management.
 */

const initMatrixSchema = async (db) => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // 1. Create Tiers Table
            db.run(`
                CREATE TABLE IF NOT EXISTS partnership_tiers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tier_name TEXT UNIQUE NOT NULL,
                    min_score INTEGER NOT NULL,
                    multiplier REAL NOT NULL, -- Capital-to-Commitment Ratio
                    interest_rate REAL NOT NULL, -- Annual Interest for Financing
                    auto_approval_limit REAL NOT NULL,
                    color_code TEXT DEFAULT 'gray',
                    description TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating partnership_tiers table:', err);
                    return reject(err);
                }

                // Seed default tiers if empty
                db.get('SELECT COUNT(*) as count FROM partnership_tiers', [], (err, row) => {
                    if (err) {
                        console.error('Error checking partnership_tiers:', err);
                        return reject(err);
                    }

                    if (row.count === 0) {
                        const defaultTiers = [
                            { tier_name: 'Probation', min_score: 0, multiplier: 1.0, interest_rate: 15.0, auto_approval_limit: 0, color_code: 'gray', description: 'New partnership under review' },
                            { tier_name: 'Bronze', min_score: 40, multiplier: 1.5, interest_rate: 12.0, auto_approval_limit: 50000, color_code: 'brown', description: 'Standard partnership tier' },
                            { tier_name: 'Silver', min_score: 70, multiplier: 2.5, interest_rate: 10.0, auto_approval_limit: 100000, color_code: 'blue', description: 'Trusted partnership tier' },
                            { tier_name: 'Gold', min_score: 90, multiplier: 4.0, interest_rate: 8.0, auto_approval_limit: 500000, color_code: 'gold', description: 'Elite partnership tier' }
                        ];

                        const stmt = db.prepare(`INSERT INTO partnership_tiers 
                            (tier_name, min_score, multiplier, interest_rate, auto_approval_limit, color_code, description) 
                            VALUES (?, ?, ?, ?, ?, ?, ?)`);

                        defaultTiers.forEach(tier => {
                            stmt.run(
                                tier.tier_name,
                                tier.min_score,
                                tier.multiplier,
                                tier.interest_rate,
                                tier.auto_approval_limit,
                                tier.color_code,
                                tier.description
                            );
                        });

                        stmt.finalize((err) => {
                            if (err) {
                                console.error('Error seeding partnership_tiers:', err);
                                return reject(err);
                            }
                            console.log('✅ Partnership tiers seeded successfully');
                        });
                    } else {
                        console.log('Partnership tiers already exist, skipping seeding.');
                    }
                });

                // Create topup_requests table for approval workflow
                db.run(`
                    CREATE TABLE IF NOT EXISTS topup_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_id INTEGER NOT NULL,
                        commitment_amount DECIMAL(15, 2) NOT NULL,
                        topup_amount DECIMAL(15, 2) NOT NULL,
                        status VARCHAR(20) DEFAULT 'PENDING',
                        requested_by INTEGER NOT NULL,
                        approved_by INTEGER,
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        approved_at DATETIME,
                        FOREIGN KEY (group_id) REFERENCES groups(id),
                        FOREIGN KEY (requested_by) REFERENCES users(id),
                        FOREIGN KEY (approved_by) REFERENCES users(id)
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating topup_requests table:', err);
                        return reject(err);
                    } else {
                        console.log('✅ topup_requests table ready');
                        resolve(); // Resolve the promise after all tables are created and seeded
                    }
                });
            });
        });
    });
};

module.exports = { initMatrixSchema };
