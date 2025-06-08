# Database Migrations

This directory contains database migration scripts for the UWhatGov application.

## Migration 001: Chat Functionality

**File:** `001_add_chat_tables.sql`

**Purpose:** Adds chat functionality to the application with persistent conversation storage.

### Changes Made:

1. **Updated reactions table:**
   - Renamed `speech_original_index` to `speech_index` 
   - Changed primary key from `BIGSERIAL` to `UUID`
   - Added `updated_at` timestamp column
   - Updated unique constraints and indexes

2. **Added chat_conversations_uwhatgov table:**
   - Stores individual chat conversations
   - Links conversations to users and debates
   - Includes conversation titles and timestamps

3. **Added chat_messages_uwhatgov table:**
   - Stores individual messages within conversations
   - Supports both user and assistant messages
   - Maintains message order with timestamps

4. **Added Row Level Security (RLS):**
   - Users can only access their own conversations and messages
   - Proper foreign key relationships ensure data integrity

5. **Added indexes:**
   - Optimized for querying conversations by user/debate
   - Efficient message retrieval by conversation

### Running the Migration:

To apply this migration to your Supabase database:

1. Copy the contents of `001_add_chat_tables.sql`
2. Run in Supabase SQL Editor or via CLI
3. Verify tables were created successfully

### Dependencies:

- Requires existing `auth.users` table (Supabase Auth)
- Requires existing `casual_debates_uwhatgov` table
- Uses Supabase RLS for security

### API Endpoints:

After running this migration, the following API endpoints will work:

- `GET /api/chat/conversations` - List user's conversations
- `POST /api/chat/conversations` - Create new conversation
- `GET /api/chat/conversations/[id]/messages` - Get conversation messages
- `POST /api/chat/[debateId]` - Send chat message (creates conversation if needed) 