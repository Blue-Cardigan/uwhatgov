-- Migration: Change debate_id from UUID to TEXT
-- This handles the case where Hansard debate IDs are not valid UUIDs

-- Step 1: Drop the foreign key constraint
ALTER TABLE reactions_uwhatgov DROP CONSTRAINT reactions_uwhatgov_debate_id_fkey;

-- Step 2: Change the column types
ALTER TABLE casual_debates_uwhatgov ALTER COLUMN id TYPE TEXT;
ALTER TABLE reactions_uwhatgov ALTER COLUMN debate_id TYPE TEXT;

-- Step 3: Re-add the foreign key constraint
ALTER TABLE reactions_uwhatgov 
ADD CONSTRAINT reactions_uwhatgov_debate_id_fkey 
FOREIGN KEY (debate_id) REFERENCES casual_debates_uwhatgov(id) ON DELETE CASCADE;

-- Note: If you have existing data that needs to be preserved, you might need additional steps
-- to convert any existing UUID values to text format, but typically these tables would be empty
-- during initial setup. 