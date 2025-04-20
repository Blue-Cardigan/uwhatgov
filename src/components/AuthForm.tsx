'use client';

import { useState, FormEvent } from 'react';
// Import the hook to get the SSR-compatible client instance from context
import { useAuth } from '@/contexts/AuthContext';

interface AuthFormProps {
  onSuccess?: () => void; // Optional callback on successful sign-in/sign-up
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  // Get the supabase client instance from the context
  const { supabase } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Optional: Add email redirect URL if needed for confirmation
            // emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.user?.identities?.length === 0) {
          // This can happen if user already exists but isn't confirmed
          setMessage('User already exists. Please check your email to confirm your account or try signing in.');
        } else if (data.session) {
          // Sign up successful AND session created (user might be auto-logged in)
          setMessage('Sign up successful! You are now logged in.');
          // No longer reload, call onSuccess to close modal
          onSuccess?.(); 
        } else {
          // Sign up successful, but requires email confirmation
          setMessage('Sign up successful! Please check your email to confirm your account.');
          // Keep modal open for this message
        }
        // Don't clear fields immediately if confirmation needed
        // setEmail('');
        // setPassword('');
      } else {
        // Sign In
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setMessage('Sign in successful!');
        // No longer reload, call onSuccess to close modal
        onSuccess?.(); 
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.error_description || err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold text-center text-gray-800 mb-6">
        {isSignUp ? 'Create Account' : 'Sign In'}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
          />
        </div>
        <div className="mb-6">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6} // Supabase default minimum password length
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
          />
        </div>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        {message && <p className="text-green-500 text-sm mb-4">{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition duration-150 ease-in-out"
        >
          {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
        </button>
      </form>
      <button
        onClick={() => {
          setIsSignUp(!isSignUp);
          setError(null);
          setMessage(null);
          // Keep email/password fields if desired, or clear them:
          // setEmail('');
          // setPassword('');
        }}
        className="mt-4 text-sm text-indigo-600 hover:text-indigo-500 w-full text-center"
      >
        {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
      </button>
    </div>
  );
} 