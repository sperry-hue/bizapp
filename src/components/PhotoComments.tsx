import React, { useState, useEffect } from 'react';
import { PhotoComment, User } from '../types';
import { apiFetch } from '../services/api';
import { Send, AtSign, Loader2 } from 'lucide-react';

interface PhotoCommentsProps {
  photoId: number;
  user: User;
}

export default function PhotoComments({ photoId, user }: PhotoCommentsProps) {
  const [comments, setComments] = useState<PhotoComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [photoId]);

  const fetchComments = async () => {
    try {
      const res = await apiFetch(`/api/photos/${photoId}/comments`);
      const data = await res.json();
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/photos/${photoId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ text: newComment })
      });
      if (res.ok) {
        setNewComment('');
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200 w-80">
      <div className="p-4 border-b border-slate-200 bg-white">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <AtSign className="w-4 h-4 text-brand" />
          Comments & Mentions
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            No comments yet. Use @username to mention someone.
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-900">{comment.username}</span>
                <span className="text-[10px] text-slate-400">{new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 text-sm text-slate-700 shadow-sm">
                {comment.text.split(/(@\w+)/g).map((part, i) => 
                  part.startsWith('@') ? (
                    <span key={i} className="text-brand font-bold">{part}</span>
                  ) : part
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-slate-200">
        <div className="relative">
          <input
            type="text"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full pl-3 pr-10 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-brand transition"
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="absolute right-1 top-1 p-1 text-brand hover:bg-brand-light rounded-full transition disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 px-2">
          Tip: Type @admin or @tech1 to notify them.
        </p>
      </form>
    </div>
  );
}
