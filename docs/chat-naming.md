# Chat Conversation Naming

## Overview

The chat system now automatically generates concise, descriptive names for conversations after the first AI response is received.

## How it works

1. **Automatic Trigger**: When a user sends their first message and receives the first AI response, the system automatically triggers name generation.

2. **AI-Generated Names**: Uses Google Gemini to analyze the user's first message and generate a 6-word maximum title that captures the main topic or question.

3. **Immediate UI Update**: The generated name is returned with the chat response and immediately updates the conversation title in the UI without requiring a page refresh.

## API Endpoints

### `POST /api/chat/conversations/[conversationId]/generate-name`

Generates a concise name for a chat conversation.

**Requirements:**
- User must be authenticated
- Conversation must belong to the authenticated user
- At least one assistant response must exist in the conversation

**Response:**
```typescript
{
  title: string;
  success: boolean;
  error?: string;
}
```

**Example Response:**
```json
{
  "title": "NHS Funding Question",
  "success": true
}
```

### Modified Chat Response

The main chat endpoint (`POST /api/chat/[debateId]`) now also returns the generated title when it's the first response:

**Enhanced Response:**
```typescript
{
  message: {
    id?: string;
    role: 'assistant';
    content: string;
    timestamp: string;
    groundingMetadata?: any;
  };
  generatedTitle?: string | null;
  success: boolean;
}
```

## Implementation Details

- The endpoint analyzes the user's first message to understand the conversation topic
- Names are limited to 6 words to ensure they're concise and readable
- The system updates the conversation title in the database automatically
- The generated title is returned in the chat response for immediate UI updates
- If name generation fails, the main chat functionality continues unaffected
- Frontend immediately updates the conversation list and selected conversation title

## Examples of Generated Names

- "NHS Funding Question"
- "Brexit Vote Analysis" 
- "Housing Policy Discussion"
- "MP Voting Record Query" 