-- Migration: Add chat functionality tables and update reactions table
-- Date: 2024-01-09

-- First, update the existing reactions table to use speech_index instead of speech_original_index
ALTER TABLE reactions_uwhatgov 
RENAME COLUMN speech_original_index TO speech_index;

-- Update the unique constraint name
ALTER TABLE reactions_uwhatgov 
DROP CONSTRAINT reactions_uwhatgov_user_id_debate_id_speech_original_index_emoji_key;

ALTER TABLE reactions_uwhatgov 
ADD CONSTRAINT reactions_uwhatgov_user_id_debate_id_speech_index_emoji_key 
UNIQUE (user_id, debate_id, speech_index, emoji);

-- Update the index name
DROP INDEX IF EXISTS idx_reactions_debate_id_speech_index;
CREATE INDEX idx_reactions_debate_id_speech_index ON reactions_uwhatgov(debate_id, speech_index);

-- Add updated_at column to reactions table if it doesn't exist
ALTER TABLE reactions_uwhatgov 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Create chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations_uwhatgov (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    debate_id TEXT NOT NULL REFERENCES casual_debates_uwhatgov(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create chat messages table
CREATE TABLE IF NOT EXISTS chat_messages_uwhatgov (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations_uwhatgov(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_debate ON chat_conversations_uwhatgov(user_id, debate_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_updated_at ON chat_conversations_uwhatgov(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages_uwhatgov(conversation_id, created_at);

-- Add trigger to update updated_at on conversation changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = timezone('utc'::text, now());
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to conversations table
CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON chat_conversations_uwhatgov
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE chat_conversations_uwhatgov ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages_uwhatgov ENABLE ROW LEVEL SECURITY;

-- Policies for chat conversations
CREATE POLICY "Users can view their own conversations"
ON chat_conversations_uwhatgov
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
ON chat_conversations_uwhatgov
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
ON chat_conversations_uwhatgov
FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
ON chat_conversations_uwhatgov
FOR DELETE USING (auth.uid() = user_id);

-- Policies for chat messages
CREATE POLICY "Users can view messages in their own conversations"
ON chat_messages_uwhatgov
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM chat_conversations_uwhatgov 
        WHERE id = conversation_id AND user_id = auth.uid()
    )
);

CREATE POLICY "Users can create messages in their own conversations"
ON chat_messages_uwhatgov
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM chat_conversations_uwhatgov 
        WHERE id = conversation_id AND user_id = auth.uid()
    )
);

-- No update/delete policies for messages (they should be immutable) 