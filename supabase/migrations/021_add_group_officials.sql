-- Add officials columns to groups table
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS chairperson TEXT,
ADD COLUMN IF NOT EXISTS secretary TEXT,
ADD COLUMN IF NOT EXISTS treasurer TEXT;

COMMENT ON COLUMN groups.chairperson IS 'Name of the group chairperson';
COMMENT ON COLUMN groups.secretary IS 'Name of the group secretary';
COMMENT ON COLUMN groups.treasurer IS 'Name of the group treasurer';
