import React, { useState } from 'react';
import { User, Settings } from '../types';
import { Zap, Loader2, Lightbulb } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function Login({ onLogin, settings }: { onLogin: (user: User) => void, settings: Settings | null }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    
    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (data.success) {
        if (data.token) {
          localStorage.setItem('session_token', data.token);
        }
        onLogin(data.user);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message === 'Load failed' || err.message === 'Failed to fetch' 
        ? 'Network error: Could not reach the server. Please check your connection.' 
        : 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-2xl shadow-3d border border-slate-200 hover:shadow-3d-hover transition-all duration-300">
      <div className="flex justify-center mb-8">
        {settings?.app_icon_url ? (
          <img src={settings.app_icon_url} alt="Icon" className="h-24 w-auto object-contain" referrerPolicy="no-referrer" />
        ) : settings?.logo_url ? (
          <img src={settings.logo_url} alt="Logo" className="h-24 w-auto object-contain" referrerPolicy="no-referrer" />
        ) : (
          <div className="bg-brand p-4 rounded-2xl shadow-lg shadow-brand/20">
            <Lightbulb className="w-12 h-12 text-white" />
          </div>
        )}
      </div>
      <h2 className="text-2xl font-bold mb-6 text-center text-slate-800">
        Login to {settings?.company_name?.replace(' Solutions Inc.', '') || 'Central Electrical'}
      </h2>
      {error && <div className="bg-brand-light text-brand p-3 rounded mb-4 text-sm">{error}</div>}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
          <input 
            type="text" 
            value={username} 
            onChange={e => setUsername(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand focus:border-brand outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)}
            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand focus:border-brand outline-none"
            required
          />
        </div>
        <button 
          type="submit"
          disabled={isLoggingIn}
          className="w-full bg-brand text-white py-2 rounded font-medium hover:bg-brand-hover transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoggingIn && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoggingIn ? 'Signing In...' : 'Sign In'}
        </button>
      </form>
      
    </div>
  );
}
