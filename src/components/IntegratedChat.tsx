'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  groundingMetadata?: any;
}

interface Conversation {
  id: string;
  user_id: string;
  debate_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface IntegratedChatProps {
  debateId: string;
  debateTitle?: string;
  setChatMode: (mode: 'debate' | 'chat') => void;
}

// Icons
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.896 28.896 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.896 28.896 0 0 0 3.105 2.288Z" />
  </svg>
);

const LoadingIcon = () => (
  <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
  </svg>
);

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" className="w-4 h-4">
    <path d="M34,256,210,80l21.21,21.2L91.4,241H478v30H91.4L231.25,410.84,210,432Z" />
  </svg>
);

export default function IntegratedChat({ debateId, debateTitle, setChatMode }: IntegratedChatProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversations when component mounts or debate changes
  const loadConversations = useCallback(async () => {
    if (!user || !debateId) return;

    setIsLoadingConversations(true);
    try {
      const response = await fetch(`/api/chat/conversations?debateId=${debateId}`);
      const data = await response.json();

      if (response.ok) {
        setConversations(data.conversations || []);
        // Auto-select the most recent conversation
        if (data.conversations?.length > 0) {
          setSelectedConversation(data.conversations[0]);
        }
      } else {
        throw new Error(data.error || 'Failed to load conversations');
      }
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setError(err.message);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user, debateId]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      const data = await response.json();

      if (response.ok) {
        setMessages(data.messages || []);
      } else {
        throw new Error(data.error || 'Failed to load messages');
      }
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError(err.message);
    }
  }, []);

  // Create new conversation
  const createNewConversation = useCallback(async () => {
    if (!user || !debateId) return;

    try {
      const title = `Chat about ${debateTitle || 'Debate'} - ${new Date().toLocaleDateString()}`;
      
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debateId, title })
      });

      const data = await response.json();

      if (response.ok) {
        setConversations(prev => [data.conversation, ...prev]);
        setSelectedConversation(data.conversation);
        setMessages([]);
      } else {
        throw new Error(data.error || 'Failed to create conversation');
      }
    } catch (err: any) {
      console.error('Error creating conversation:', err);
      setError(err.message);
    }
  }, [user, debateId, debateTitle]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading || !user || !selectedConversation) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/chat/${debateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId: selectedConversation.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setMessages(prev => [...prev, data.message]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, user, selectedConversation, debateId]);

  // Load conversations when component mounts
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when conversation changes
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    }
  }, [selectedConversation, loadMessages]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!user) {
    return (
      <div className="p-4 text-center text-gray-400">
        <ChatIcon />
        <p className="mt-2 text-sm">Sign in to ask questions about this debate</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0b141a] border-t border-gray-700">
      {/* Conversation Selector with New Chat Button */}
      {conversations.length > 0 && (
        <div className="p-2 border-b border-gray-700 bg-[#111b21] flex items-center">
          <button
            onClick={() => setChatMode('debate')}
            className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white flex-shrink-0"
            title="Return to debate"
          >
            <ArrowLeftIcon />
          </button>
          <button
            onClick={createNewConversation}
            className="p-2 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white flex-shrink-0"
            title="New conversation"
          >
            <PlusIcon />
          </button>
          <select
            value={selectedConversation?.id || ''}
            onChange={(e) => {
              const conv = conversations.find(c => c.id === e.target.value);
              setSelectedConversation(conv || null);
            }}
            className="flex-1 min-w-0 p-2 ml-2 text-xs bg-[#2a3942] border border-gray-600 rounded text-white"
          >
            <option value="">Select conversation...</option>
            {conversations.map((conv) => (
              <option key={conv.id} value={conv.id}>
                {conv.title} ({formatTimestamp(conv.updated_at)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoadingConversations ? (
          <div className="text-center py-4">
            <LoadingIcon />
            <p className="text-xs text-gray-400 mt-1">Loading conversations...</p>
          </div>
        ) : !selectedConversation ? (
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm mb-2">No conversations yet</p>
            <button
              onClick={createNewConversation}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-white text-xs"
            >
              Start chatting
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            <p className="text-xs">Ask your first question about this debate!</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-2 rounded text-xs ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-[#2a3942] text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className={`text-xs mt-1 opacity-70 ${
                  message.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                }`}>
                  {formatTimestamp(message.timestamp)}
                </div>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#2a3942] p-2 rounded flex items-center gap-2">
              <LoadingIcon />
              <span className="text-gray-300 text-xs">Thinking...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <div className="bg-red-900 text-red-200 p-2 rounded text-xs">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700 bg-[#202c33]">
        {selectedConversation ? (
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question..."
              className="flex-1 p-2 bg-[#2a3942] border border-gray-600 rounded text-white placeholder-gray-400 resize-none focus:outline-none focus:border-indigo-500 text-xs"
              rows={1}
              style={{ minHeight: '32px', maxHeight: '80px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white transition-colors"
            >
              <SendIcon />
            </button>
          </div>
        ) : (
          <button
            onClick={createNewConversation}
            className="w-full p-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white text-xs"
          >
            Start a new conversation
          </button>
        )}
      </div>
    </div>
  );
} 