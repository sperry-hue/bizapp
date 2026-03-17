import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Users, PlusCircle, Edit, Trash2, Shield, Wrench } from 'lucide-react';
import { apiFetch } from '../services/api';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'tech'>('tech');
  const [hourlyRate, setHourlyRate] = useState<string>('0');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = () => {
    apiFetch('/api/users')
      .then(res => res.json())
      .then(data => setUsers(data))
      .catch(err => console.error("Failed to fetch users", err));
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingUserId(null);
    setUsername('');
    setPassword('');
    setRole('tech');
    setHourlyRate('0');
    setError('');
  };

  const handleEdit = (user: User) => {
    setEditingUserId(user.id);
    setUsername(user.username);
    setPassword(''); // Don't populate password
    setRole(user.role);
    setHourlyRate(user.hourly_rate?.toString() || '0');
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
        return;
      }
      fetchUsers();
    } catch (e) {
      alert('Failed to delete user');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const url = editingUserId ? `/api/users/${editingUserId}` : '/api/users';
    const method = editingUserId ? 'PUT' : 'POST';
    
    const body: any = { username, role, hourly_rate: parseFloat(hourlyRate) || 0 };
    if (password) body.password = password;
    
    try {
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save user');
        return;
      }
      
      resetForm();
      fetchUsers();
    } catch (e) {
      setError('An error occurred while saving the user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-brand" />
          User Management
        </h2>
        <button 
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-hover transition flex items-center gap-2"
        >
          <PlusCircle className="w-5 h-5" />
          New User
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 hover:shadow-3d-hover transition-all duration-300">
          <h3 className="text-lg font-semibold mb-4">{editingUserId ? 'Edit User' : 'Create New User'}</h3>
          
          {error && (
            <div className="mb-4 p-3 bg-brand-light text-brand rounded border border-brand/20 text-sm">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input 
                  type="text" 
                  required 
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  className="w-full p-2 border border-slate-300 rounded" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password {editingUserId && <span className="text-xs text-slate-500 font-normal">(Leave blank to keep current)</span>}
                </label>
                <input 
                  type="password" 
                  required={!editingUserId} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full p-2 border border-slate-300 rounded" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select 
                  value={role} 
                  onChange={e => setRole(e.target.value as 'admin' | 'tech')} 
                  className="w-full p-2 border border-slate-300 rounded"
                >
                  <option value="tech">Technician</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hourly Rate ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={hourlyRate} 
                  onChange={e => setHourlyRate(e.target.value)} 
                  className="w-full p-2 border border-slate-300 rounded" 
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded font-medium transition">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-brand text-white rounded font-medium hover:bg-brand-hover transition">
                {editingUserId ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-3d border border-slate-200 overflow-hidden hover:shadow-3d-hover transition-all duration-300">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-700">Username</th>
              <th className="p-4 font-semibold text-slate-700">Role</th>
              <th className="p-4 font-semibold text-slate-700">Hourly Rate</th>
              <th className="p-4 font-semibold text-slate-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                <td className="p-4 font-medium text-slate-800">{user.username}</td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                  }`}>
                    {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </td>
                <td className="p-4 text-slate-600 font-medium">
                  ${user.hourly_rate?.toFixed(2) || '0.00'}
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => handleEdit(user)} className="p-2 text-slate-400 hover:text-indigo-600 transition" title="Edit">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="p-2 text-slate-400 hover:text-brand transition" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-500">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
