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
    id TEXT PRIMARY KEY, -- Changed from UUID to TEXT to handle Hansard debate IDs
    content TEXT,
    summary TEXT, -- Added column for storing the debate summary
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


-- Table to store emoji reactions on debates
CREATE TABLE reactions_uwhatgov (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    debate_id TEXT NOT NULL REFERENCES casual_debates_uwhatgov(id) ON DELETE CASCADE,
    speech_original_index INTEGER NOT NULL, -- Added: Index of the speech within the debate content
    emoji TEXT NOT NULL CHECK (char_length(emoji) > 0), -- Ensure emoji is not empty
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Prevent duplicate reactions from the same user on the same speech with the same emoji
    UNIQUE (user_id, debate_id, speech_original_index, emoji)
);

-- Indexes for efficient querying
-- Composite index might be better depending on query patterns
CREATE INDEX idx_reactions_debate_id_speech_index ON reactions_uwhatgov(debate_id, speech_original_index);
CREATE INDEX idx_reactions_user_id ON reactions_uwhatgov(user_id);

-- Enable Row Level Security
ALTER TABLE reactions_uwhatgov ENABLE ROW LEVEL SECURITY;

-- Policies for reactions
CREATE POLICY "Allow users to read all reactions"
ON reactions_uwhatgov
FOR SELECT USING (true);

CREATE POLICY "Allow users to insert their own reactions"
ON reactions_uwhatgov
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own reactions"
ON reactions_uwhatgov
FOR DELETE USING (auth.uid() = user_id);

-- Optional: Grant usage on sequence if needed for specific roles (usually handled by Supabase)
-- GRANT USAGE, SELECT ON SEQUENCE reactions_uwhatgov_id_seq TO authenticated;
