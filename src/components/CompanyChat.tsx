import React, { useState, useEffect, useRef } from 'react';
import { Message, User } from '../types';
import { apiFetch } from '../services/api';
import { Send, Loader2, User as UserIcon, Clock } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface CompanyChatProps {
  user: User;
}

export default function CompanyChat({ user }: CompanyChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    fetchMessages();

    // Initialize socket connection
    const token = localStorage.getItem('session_token');
    socketRef.current = io({
      auth: { token }
    });

    socketRef.current.on('chat_message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await apiFetch('/api/messages');
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ text: newMessage })
      });
      if (res.ok) {
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="w-8 h-8 text-brand animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-2xl shadow-3d border border-slate-200 overflow-hidden">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">Company Chat</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Real-time team communication</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Live</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
              <Send className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.user_id === user.id;
            const showHeader = idx === 0 || messages[idx - 1].user_id !== msg.user_id;
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {showHeader && (
                  <div className={`flex items-center gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{msg.username}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${msg.role === 'admin' ? 'bg-brand-light text-brand' : 'bg-slate-100 text-slate-600'}`}>
                      {msg.role}
                    </span>
                  </div>
                )}
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                  isMe 
                    ? 'bg-brand text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                }`}>
                  {msg.text}
                  <div className={`text-[9px] mt-1 flex items-center gap-1 ${isMe ? 'text-white/70 justify-end' : 'text-slate-400'}`}>
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-100">
        <div className="relative flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-slate-100 border-none rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-brand transition-all shadow-inner"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || submitting}
            className="bg-brand text-white p-3 rounded-xl hover:bg-brand-hover disabled:opacity-50 disabled:hover:bg-brand transition-all shadow-lg active:scale-95"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}
