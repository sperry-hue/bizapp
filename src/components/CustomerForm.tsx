import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, User } from 'lucide-react';
import { apiFetch } from '../services/api';
import { Customer } from '../types';
import AddressAutocomplete from './AddressAutocomplete';

interface CustomerFormProps {
  customer?: Customer;
  onClose: () => void;
  onSaved: (savedCustomer?: Customer) => void;
}

export default function CustomerForm({ customer, onClose, onSaved }: CustomerFormProps) {
  const [name, setName] = useState(customer?.name || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [jobSites, setJobSites] = useState<{id: number, name: string, address: string}[]>([]);
  const [pendingJobSites, setPendingJobSites] = useState<{name: string, address: string}[]>([]);
  const [newJobSiteName, setNewJobSiteName] = useState('');
  const [newJobSiteAddress, setNewJobSiteAddress] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      fetchJobSites();
    }
  }, [customer]);

  const fetchJobSites = async () => {
    if (!customer) return;
    try {
      const res = await apiFetch(`/api/customers/${customer.id}/job-sites`);
      const data = await res.json();
      setJobSites(data);
    } catch (e) {
      console.error('Failed to fetch job sites:', e);
    }
  };

  const handleAddJobSite = async () => {
    if (!newJobSiteName || !newJobSiteAddress) return;
    
    if (customer) {
      try {
        await apiFetch('/api/job-sites', {
          method: 'POST',
          body: JSON.stringify({ customer_id: customer.id, name: newJobSiteName, address: newJobSiteAddress })
        });
        setNewJobSiteName('');
        setNewJobSiteAddress('');
        fetchJobSites();
      } catch (e) {
        console.error('Failed to add job site:', e);
      }
    } else {
      setPendingJobSites([...pendingJobSites, { name: newJobSiteName, address: newJobSiteAddress }]);
      setNewJobSiteName('');
      setNewJobSiteAddress('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const method = customer ? 'PUT' : 'POST';
      const url = customer ? `/api/customers/${customer.id}` : '/api/customers';
      
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({ name, address, phone, email })
      });

      if (res.ok) {
        const savedCustomer = await res.json();
        
        // If there are pending job sites, create them now
        if (!customer && pendingJobSites.length > 0) {
          for (const js of pendingJobSites) {
            await apiFetch('/api/job-sites', {
              method: 'POST',
              body: JSON.stringify({ customer_id: savedCustomer.id, name: js.name, address: js.address })
            });
          }
        }
        
        onSaved(savedCustomer);
        onClose();
      }
    } catch (error) {
      console.error('Failed to save customer:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">
            {customer ? 'Edit Customer' : 'New Customer'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
            <AddressAutocomplete
              required
              value={address}
              onChange={setAddress}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
              placeholder="123 Main St, City, Province"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                placeholder="902-555-0123"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email (Optional)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4">
            <h4 className="text-sm font-bold text-slate-800 mb-2">Job Sites</h4>
            <div className="space-y-2 mb-4">
              {customer ? (
                jobSites.map(js => (
                  <div key={js.id} className="text-sm text-slate-600 p-2 bg-slate-50 rounded-lg">
                    <span className="font-semibold">{js.name}</span> - {js.address}
                  </div>
                ))
              ) : (
                pendingJobSites.map((js, index) => (
                  <div key={index} className="text-sm text-slate-600 p-2 bg-slate-50 rounded-lg">
                    <span className="font-semibold">{js.name}</span> - {js.address}
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={newJobSiteName}
                onChange={(e) => setNewJobSiteName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                placeholder="Job Site Name"
              />
              <input
                type="text"
                value={newJobSiteAddress}
                onChange={(e) => setNewJobSiteAddress(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                placeholder="Job Site Address"
              />
              <button
                type="button"
                onClick={handleAddJobSite}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition"
              >
                Add Job Site
              </button>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-brand text-white font-bold rounded-lg hover:bg-brand-hover transition flex items-center justify-center gap-2 shadow-lg shadow-brand/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {customer ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
