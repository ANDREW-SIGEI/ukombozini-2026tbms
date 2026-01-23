-- =====================================================
-- 015 - DIVIDEND MANUAL OVERRIDES
-- =====================================================
-- Adds support for manual group name overrides in dividend runs
-- This allows printing reports with custom group names while linking to a system group ID

ALTER TABLE dividend_runs 
ADD COLUMN IF NOT EXISTS manual_group_name VARCHAR(255);

COMMENT ON COLUMN dividend_runs.manual_group_name IS 'Optional custom group name for PDF reports (overrides linked group name)';
