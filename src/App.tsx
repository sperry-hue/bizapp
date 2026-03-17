/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import TechDashboard from './components/TechDashboard';
import JobDetail from './components/JobDetail';
import CustomerDetail from './components/CustomerDetail';
import CustomerPortal from './components/CustomerPortal';
import PublicDocumentView from './components/PublicDocumentView';
import CompanyChat from './components/CompanyChat';
import { User, Notification, Settings } from './types';
import './services/syncService';
import { apiFetch } from './services/api';
import { io, Socket } from 'socket.io-client';
import { Bell, X, MessageSquare, Lightbulb } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const libraries: ("places")[] = ["places"];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries,
  });

  useEffect(() => {
    apiFetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    apiFetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error('Failed to fetch settings:', err));
  }, []);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('session_token');
      const newSocket = io(window.location.origin, {
        auth: { token }
      });

      newSocket.on('notification', (notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);
      });

      setSocket(newSocket);

      apiFetch('/api/notifications')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setNotifications(data);
        });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: number) => {
    await apiFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        <header className="bg-white/80 backdrop-blur-md text-slate-900 px-4 py-3 sticky top-0 z-50 border-b border-slate-200/60 shadow-sm">
          <div className="max-w-7xl mx-auto flex justify-between items-center w-full">
            <Link to="/" className="text-xl font-black tracking-tighter flex items-center gap-3 group">
              {settings?.app_icon_url ? (
                <img src={settings.app_icon_url} alt="Icon" className="h-10 w-auto object-contain transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
              ) : settings?.logo_url ? (
                <img src={settings.logo_url} alt="Logo" className="h-10 w-auto object-contain transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
              ) : (
                <Lightbulb className="w-8 h-8 text-brand transition-transform group-hover:scale-110" />
              )}
              <span className="bg-gradient-to-r from-brand to-brand/80 bg-clip-text text-transparent">
                {settings?.company_name?.replace(' Solutions Inc.', '') || 'Central Electrical'}
              </span>
            </Link>

            {user && (
              <nav className="flex items-center gap-1">
                <Link 
                  to="/chat" 
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:text-brand hover:bg-brand-light transition-all"
                >
                  <MessageSquare className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Team Chat</span>
                </Link>
              </nav>
            )}

            {user && (
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="relative" ref={notificationRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-all relative group"
                  >
                    <Bell className="w-5 h-5 text-slate-500 group-hover:text-brand" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 bg-brand text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50"
                    >
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">Notifications</h3>
                        <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400">
                            <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-sm">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <Link
                              key={n.id}
                              to={n.link}
                              onClick={() => {
                                markAsRead(n.id);
                                setShowNotifications(false);
                              }}
                              className={`block p-4 border-b border-slate-50 hover:bg-slate-50 transition ${!n.is_read ? 'bg-brand-light' : ''}`}
                            >
                              <div className="flex gap-3">
                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.is_read ? 'bg-brand' : 'bg-transparent'}`} />
                                <div>
                                  <p className={`text-sm ${!n.is_read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                    {n.content}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    {new Date(n.created_at).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

                <div className="hidden md:flex flex-col items-end">
                  <span className="text-xs font-bold text-slate-900">{user.username}</span>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{user.role}</span>
                </div>
                <button 
                  onClick={() => {
                    apiFetch('/api/logout', { method: 'POST' }).then(() => {
                      localStorage.removeItem('session_token');
                      setUser(null);
                      window.location.href = '/';
                    });
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-brand px-3 py-2 rounded-xl hover:bg-brand-light transition-all flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Logout
                </button>
            </div>
          )}
          </div>
        </header>
        
        <main className="p-4 max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={
              !user ? <Login onLogin={setUser} settings={settings} /> : 
              user.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/tech" />
            } />
            <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} />
            <Route path="/tech" element={user?.role === 'tech' ? <TechDashboard user={user} /> : <Navigate to="/" />} />
            <Route path="/job/:id" element={user ? <JobDetail user={user} /> : <Navigate to="/" />} />
            <Route path="/customer/:id" element={user?.role === 'admin' ? <CustomerDetail user={user} /> : <Navigate to="/" />} />
            <Route path="/chat" element={user ? <CompanyChat user={user} /> : <Navigate to="/" />} />
            <Route path="/portal/:id" element={<CustomerPortal />} />
            <Route path="/invoice/:token" element={<PublicDocumentView type="invoice" />} />
            <Route path="/estimate/:token" element={<PublicDocumentView type="estimate" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
