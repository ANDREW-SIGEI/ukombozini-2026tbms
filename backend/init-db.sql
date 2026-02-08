-- Ukombozi TBMS PostgreSQL Initialization Script
-- This script runs automatically on first container startup

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Health check endpoint support
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) DEFAULT 'healthy',
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO system_health (status) VALUES ('healthy');

-- Add any additional initialization here
-- Note: The main schema will be created by your backend migrations/initDb.js
