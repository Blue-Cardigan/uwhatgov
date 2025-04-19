-- Table to store original Hansard debate JSON data
-- REMOVED: No longer storing original Hansard data
-- CREATE TABLE debates_uwhatgov (
--     id UUID PRIMARY KEY,
--     data JSONB NOT NULL,
--     fetched_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
--     last_accessed_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
-- );

-- Optional: Function to update last_accessed_at timestamp automatically
-- Keep this function as it's used by casual_debates_uwhatgov trigger
CREATE OR REPLACE FUNCTION update_last_accessed_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.last_accessed_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Optional: Trigger to update last_accessed_at on access (SELECT)
-- Note: Supabase doesn't directly support SELECT triggers easily.
-- Manual update in the API route might be more practical.
-- We can add an UPDATE trigger if needed later.


-- Table to store the generated casual rewrite content
CREATE TABLE casual_debates_uwhatgov (
    id UUID PRIMARY KEY, -- Removed foreign key reference
    content TEXT,
    status TEXT NOT NULL DEFAULT 'success', -- e.g., pending, generating, completed, failed
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    error_message TEXT -- Store error details if generation fails
);

-- Trigger to update last_updated_at on modification
CREATE TRIGGER update_casual_debates_uwhatgov_modtime
BEFORE UPDATE ON casual_debates_uwhatgov
FOR EACH ROW
EXECUTE FUNCTION update_last_accessed_at_column(); -- Re-use the same function logic


-- Enable Row Level Security (Recommended for public facing anon key)
-- REMOVED: RLS for debates_uwhatgov
-- ALTER TABLE debates_uwhatgov ENABLE ROW LEVEL SECURITY;
ALTER TABLE casual_debates_uwhatgov ENABLE ROW LEVEL SECURITY;

-- Create policies: Allow public read access (adjust as needed)
-- REMOVED: Policy for debates_uwhatgov
-- CREATE POLICY "Allow public read access to debates_uwhatgov"
-- ON debates_uwhatgov
-- FOR SELECT USING (true);

CREATE POLICY "Allow public read access to casual debates_uwhatgov"
ON casual_debates_uwhatgov
FOR SELECT USING (true);

-- Add policies for insert/update/delete if needed from server-side functions or secure contexts
-- Example (ALLOW INSERT from service_role - typically used in backend):
-- CREATE POLICY "Allow server-side insert" ON casual_debates_uwhatgov FOR INSERT WITH CHECK (auth.role() = 'service_role');
-- CREATE POLICY "Allow server-side update" ON casual_debates_uwhatgov FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
