import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Job, User, Task, Customer, Invoice, InvoiceItem, Estimate, EstimateItem } from '../types';
import { apiFetch } from '../services/api';
import AddressAutocomplete from './AddressAutocomplete';
import { PlusCircle, Briefcase, Edit, Trash2, Calendar, X, Users, Image as ImageIcon, Receipt, Contact, Sparkles, Loader2, Clock, CheckCircle2, FileText, XCircle, Settings as SettingsIcon, Upload, Check, Lightbulb, PanelLeftClose, PanelLeftOpen, DollarSign, WifiOff } from 'lucide-react';
import UserManagement from './UserManagement';
import PhotosTab from './PhotosTab';
import CustomersTab from './CustomersTab';
import PayrollTab from './PayrollTab';
import InvoiceCreator from './InvoiceCreator';
import InvoiceView from './InvoiceView';
import WorkOrderView from './WorkOrderView';
import EstimateCreator from './EstimateCreator';
import EstimateView from './EstimateView';
import { Settings } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { getLastSyncTime } from '../services/syncService';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'users' | 'photos' | 'invoices' | 'customers' | 'estimates' | 'settings' | 'payroll'>('jobs');
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [techs, setTechs] = useState<{id: number, username: string}[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobsWithoutInvoices, setJobsWithoutInvoices] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [creatingInvoiceFor, setCreatingInvoiceFor] = useState<Job | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<{ job: Job, invoice: Invoice & { items: InvoiceItem[] } } | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [viewingWorkOrderId, setViewingWorkOrderId] = useState<number | null>(null);
  const [showStandaloneInvoice, setShowStandaloneInvoice] = useState(false);
  const [sortBy, setSortBy] = useState<'booked' | 'tech' | 'date'>('booked');
  
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [showEstimateCreator, setShowEstimateCreator] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate & { items: EstimateItem[] } | null>(null);
  const [viewingEstimateId, setViewingEstimateId] = useState<number | null>(null);
  const [estimateSortBy, setEstimateSortBy] = useState<'date' | 'expired' | 'accepted'>('date');
  
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingAppIcon, setIsUploadingAppIcon] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean, companyConnected: boolean, calendarConnected: boolean }>({ connected: false, companyConnected: false, calendarConnected: false });
  const [calendars, setCalendars] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastSync, setLastSync] = useState<number | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      const time = await getLastSyncTime();
      setLastSync(time);
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getLastSyncTime().then(setLastSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    fetchGoogleStatus();
    if (activeTab === 'settings') {
      fetchCalendars();
      fetchAllUsers();
    }
  }, [activeTab]);

  const fetchGoogleStatus = async () => {
    try {
      const res = await apiFetch('/api/auth/google/status');
      const data = await res.json();
      setGoogleStatus(data);
    } catch (e) {
      console.error('Failed to fetch Google status:', e);
    }
  };

  const fetchCalendars = async () => {
    try {
      const res = await apiFetch('/api/google/calendars');
      if (res.ok) {
        const data = await res.json();
        setCalendars(data);
      }
    } catch (e) {
      console.error('Failed to fetch calendars:', e);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await apiFetch('/api/users');
      const data = await res.json();
      setAllUsers(data);
    } catch (e) {
      console.error('Failed to fetch users:', e);
    }
  };

  const handleConnectCompanyGoogle = async () => {
    try {
      const res = await apiFetch('/api/auth/google/url?company=true');
      const data = await res.json();
      const authWindow = window.open(data.url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        alert('Please allow popups for this site to connect your Google account.');
      }
    } catch (e) {
      console.error('Failed to connect company Google:', e);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const res = await apiFetch('/api/auth/google/url?calendar=true');
      const data = await res.json();
      const authWindow = window.open(data.url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        alert('Please allow popups for this site to connect your Google account.');
      }
    } catch (e) {
      console.error('Failed to connect calendar Google:', e);
    }
  };

  const handleUpdateUserCalendar = async (userId: number, calendarId: string) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/calendar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendar_id: calendarId })
      });
      if (res.ok) {
        fetchAllUsers();
      }
    } catch (e) {
      console.error('Failed to update user calendar:', e);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchGoogleStatus();
        if (event.data.state === 'company') {
          alert('Company Google Drive connected successfully!');
        } else if (event.data.state === 'calendar') {
          alert('Google Calendar connected successfully!');
          fetchCalendars();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  
  // Reschedule state
  const [reschedulingJob, setReschedulingJob] = useState<Job | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTechs, setRescheduleTechs] = useState<number[]>([]);
  
  // Form state
  const [customerId, setCustomerId] = useState<number | string>('new');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [jobType, setJobType] = useState<string>('Service Call');
  const [assignedTechs, setAssignedTechs] = useState<number[]>([]);
  const [status, setStatus] = useState('New');
  const [scheduledDate, setScheduledDate] = useState('');
  const [tasks, setTasks] = useState<{id?: number, description: string, is_completed?: boolean}[]>([{ description: '' }]);
  const [jobSites, setJobSites] = useState<{id: number, name: string, address: string}[]>([]);
  const [selectedJobSiteId, setSelectedJobSiteId] = useState<number | null>(null);
  const [newJobSiteName, setNewJobSiteName] = useState('');
  const [newJobSiteAddress, setNewJobSiteAddress] = useState('');

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchJobs(),
          fetchTechs(),
          fetchCustomers(),
          fetchInvoices(),
          fetchJobsWithoutInvoices(),
          fetchEstimates(),
          fetchSettings()
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadAllData();
  }, []);

  const fetchJobs = () => {
    return apiFetch('/api/jobs')
      .then(res => res.json())
      .then(data => setJobs(data));
  };

  const fetchInvoices = () => {
    return apiFetch('/api/invoices')
      .then(res => res.ok ? res.json() : [])
      .then(data => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => setInvoices([]));
  };

  const fetchJobsWithoutInvoices = () => {
    return apiFetch('/api/jobs-without-invoices')
      .then(res => res.ok ? res.json() : [])
      .then(data => setJobsWithoutInvoices(Array.isArray(data) ? data : []))
      .catch(() => setJobsWithoutInvoices([]));
  };

  const fetchTechs = () => {
    return apiFetch('/api/users/techs')
      .then(res => res.json())
      .then(data => setTechs(data));
  };

  const fetchCustomers = () => {
    return apiFetch('/api/customers')
      .then(res => res.json())
      .then(data => setCustomers(data));
  };

  const fetchEstimates = () => {
    return apiFetch('/api/estimates')
      .then(res => res.ok ? res.json() : [])
      .then(data => setEstimates(Array.isArray(data) ? data : []))
      .catch(() => setEstimates([]));
  };

  const fetchSettings = () => {
    return apiFetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSavingSettings(true);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Settings saved successfully');
      }
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await apiFetch('/api/settings/logo', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => prev ? { ...prev, logo_url: data.logoUrl } : null);
        // Logo updated successfully
      }
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleAppIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAppIcon(true);
    const formData = new FormData();
    formData.append('icon', file);

    try {
      const res = await apiFetch('/api/settings/app-icon', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => prev ? { ...prev, app_icon_url: data.iconUrl } : null);
      }
    } finally {
      setIsUploadingAppIcon(false);
    }
  };

  const handleAcceptEstimate = async (id: number) => {
    const res = await apiFetch(`/api/estimates/${id}/accept`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      fetchEstimates();
      fetchInvoices();
      fetchJobs();
      setViewingEstimateId(null);
      setViewingInvoiceId(data.invoiceId);
    }
  };

  const handleDeclineEstimate = async (id: number) => {
    const res = await apiFetch(`/api/estimates/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Declined' })
    });
    if (res.ok) {
      fetchEstimates();
      setViewingEstimateId(null);
    }
  };

  const handleDeleteEstimate = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this estimate?')) {
      try {
        const res = await apiFetch(`/api/estimates/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchEstimates();
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to delete estimate');
        }
      } catch (error) {
        alert('An error occurred while deleting the estimate');
      }
    }
  };

  const handleAddTask = () => setTasks([...tasks, { description: '' }]);
  const handleTaskChange = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], description: value };
    setTasks(newTasks);
  };
  const handleRemoveTask = (index: number) => {
    const newTasks = [...tasks];
    newTasks.splice(index, 1);
    setTasks(newTasks);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingJobId(null);
    setCustomerId('new');
    setCustomerName('');
    setAddress('');
    setPhone('');
    setEmail('');
    setNotes('');
    setPriority('Medium');
    setJobType('Service Call');
    setAssignedTechs([]);
    setStatus('New');
    setScheduledDate('');
    setTasks([{ description: '' }]);
    setNewJobSiteName('');
    setNewJobSiteAddress('');
  };

  const handleCustomerSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCustomerId(val);
    if (val === 'new') {
      setCustomerName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setJobSites([]);
      setSelectedJobSiteId(null);
    } else {
      const customerId = Number(val);
      const selected = customers.find(c => c.id === customerId);
      if (selected) {
        setCustomerName(selected.name);
        setAddress(selected.address);
        setPhone(selected.phone);
        setEmail(selected.email || '');
      }
      
      try {
        const res = await apiFetch(`/api/customers/${customerId}/job-sites`);
        const data = await res.json();
        setJobSites(data);
        setSelectedJobSiteId(null);
      } catch (e) {
        console.error('Failed to fetch job sites:', e);
        setJobSites([]);
      }
    }
  };

  const handleEdit = async (job: Job) => {
    setEditingJobId(job.id);
    setCustomerName(job.customer_name);
    setAddress(job.address);
    setPhone(job.phone);
    setNotes(job.notes || '');
    setPriority(job.priority || 'Medium');
    setJobType(job.job_type || 'Service Call');
    setAssignedTechs(job.assigned_techs || []);
    setStatus(job.status || 'New');
    setScheduledDate(job.scheduled_date || '');
    
    try {
      const res = await apiFetch(`/api/jobs/${job.id}`);
      const data = await res.json();
      if (data.tasks && data.tasks.length > 0) {
        setTasks(data.tasks);
      } else {
        setTasks([{ description: '' }]);
      }
    } catch (e) {
      setTasks([{ description: '' }]);
    }
    
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this job?')) {
      try {
        const res = await apiFetch(`/api/jobs/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchJobs();
        } else {
          const data = await res.json();
          alert(data.error || 'Failed to delete job');
        }
      } catch (error) {
        alert('An error occurred while deleting the job');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalCustomerId = customerId === 'new' ? null : Number(customerId);

    // If new customer, create it first
    if (customerId === 'new') {
      const customerRes = await apiFetch('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: customerName,
          address,
          phone,
          email
        })
      });
      const customerData = await customerRes.json();
      finalCustomerId = customerData.id;
      
      // If new job site name/address provided, create it too
      if (newJobSiteName && newJobSiteAddress) {
        await apiFetch('/api/job-sites', {
          method: 'POST',
          body: JSON.stringify({ customer_id: finalCustomerId, name: newJobSiteName, address: newJobSiteAddress })
        });
      }
      
      fetchCustomers(); // Refresh customer list
    }
    
    const payload = {
      customer_name: customerName,
      address,
      phone,
      notes,
      priority,
      job_type: jobType,
      assigned_techs: assignedTechs,
      status,
      scheduled_date: scheduledDate || null,
      tasks: tasks.filter(t => t.description.trim() !== ''),
      customer_id: finalCustomerId,
      job_site_id: selectedJobSiteId
    };

    if (editingJobId) {
      await apiFetch(`/api/jobs/${editingJobId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
    } else {
      await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }
    
    resetForm();
    fetchJobs();
  };

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'Urgent': return 'bg-brand text-white';
      case 'High': return 'bg-brand-light text-brand';
      case 'Medium': return 'bg-amber-100 text-amber-800';
      case 'Low': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-indigo-100 text-indigo-800';
      case 'Pending Parts': return 'bg-purple-100 text-purple-800';
      case 'Completed': return 'bg-emerald-100 text-emerald-800';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
        <p className="text-slate-600 font-medium">Loading dashboard data...</p>
      </div>
    );
  }

  const handleRescheduleClick = (job: Job) => {
    setReschedulingJob(job);
    setRescheduleDate(job.scheduled_date || '');
    setRescheduleTechs(job.assigned_techs || []);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingJob) return;
    
    try {
      const res = await apiFetch(`/api/jobs/${reschedulingJob.id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({
          assigned_techs: rescheduleTechs,
          scheduled_date: rescheduleDate || null
        })
      });
      
      if (res.ok) {
        setReschedulingJob(null);
        fetchJobs();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reschedule job');
      }
    } catch (error) {
      alert('An error occurred while rescheduling the job');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {isOffline && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 rounded-r-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-bold">Offline Mode</p>
              <p className="text-sm opacity-90">
                You are currently offline. Changes will be saved locally and synced when you reconnect.
                {lastSync && ` Last synced: ${new Date(lastSync).toLocaleTimeString()}`}
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className={`flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 transition-all duration-300 shrink-0 sticky top-24 w-full md:w-auto ${isSidebarMinimized ? 'md:w-16' : 'md:w-48'} z-10`}>
        <div className={`hidden md:flex p-4 border-b border-slate-100 ${isSidebarMinimized ? 'justify-center' : 'justify-end'}`}>
          <button onClick={() => setIsSidebarMinimized(!isSidebarMinimized)} className="text-slate-400 hover:text-brand transition-colors">
            {isSidebarMinimized ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex flex-row md:flex-col p-2 gap-1 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`p-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-colors whitespace-nowrap ${
              activeTab === 'jobs' ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isSidebarMinimized ? 'md:justify-center' : ''}`}
            title={isSidebarMinimized ? "Jobs" : undefined}
          >
            <Briefcase className="w-5 h-5 shrink-0" />
            <span className={isSidebarMinimized ? 'md:hidden' : ''}>Jobs</span>
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`p-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-colors whitespace-nowrap ${
              activeTab === 'photos' ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isSidebarMinimized ? 'md:justify-center' : ''}`}
            title={isSidebarMinimized ? "Photos" : undefined}
          >
            <ImageIcon className="w-5 h-5 shrink-0" />
            <span className={isSidebarMinimized ? 'md:hidden' : ''}>Photos</span>
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`p-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-colors whitespace-nowrap ${
              activeTab === 'invoices' ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isSidebarMinimized ? 'md:justify-center' : ''}`}
            title={isSidebarMinimized ? "Invoices" : undefined}
          >
            <Receipt className="w-5 h-5 shrink-0" />
            <span className={isSidebarMinimized ? 'md:hidden' : ''}>Invoices</span>
          </button>
          <button
            onClick={() => setActiveTab('estimates')}
            className={`p-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-colors whitespace-nowrap ${
              activeTab === 'estimates' ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isSidebarMinimized ? 'md:justify-center' : ''}`}
            title={isSidebarMinimized ? "Estimates" : undefined}
          >
            <FileText className="w-5 h-5 shrink-0" />
            <span className={isSidebarMinimized ? 'md:hidden' : ''}>Estimates</span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`p-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-colors whitespace-nowrap ${
              activeTab === 'customers' ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isSidebarMinimized ? 'md:justify-center' : ''}`}
            title={isSidebarMinimized ? "Customers" : undefined}
          >
            <Contact className="w-5 h-5 shrink-0" />
            <span className={isSidebarMinimized ? 'md:hidden' : ''}>Customers</span>
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`p-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-colors whitespace-nowrap ${
              activeTab === 'payroll' ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isSidebarMinimized ? 'md:justify-center' : ''}`}
            title={isSidebarMinimized ? "Payroll" : undefined}
          >
            <DollarSign className="w-5 h-5 shrink-0" />
            <span className={isSidebarMinimized ? 'md:hidden' : ''}>Payroll</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`p-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-colors whitespace-nowrap ${
              activeTab === 'users' ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isSidebarMinimized ? 'md:justify-center' : ''}`}
            title={isSidebarMinimized ? "Users" : undefined}
          >
            <Users className="w-5 h-5 shrink-0" />
            <span className={isSidebarMinimized ? 'md:hidden' : ''}>Users</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`p-3 rounded-xl font-medium text-sm flex items-center gap-3 transition-colors whitespace-nowrap ${
              activeTab === 'settings' ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            } ${isSidebarMinimized ? 'md:justify-center' : ''}`}
            title={isSidebarMinimized ? "Settings" : undefined}
          >
            <SettingsIcon className="w-5 h-5 shrink-0" />
            <span className={isSidebarMinimized ? 'md:hidden' : ''}>Settings</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {activeTab === 'users' ? (
        <UserManagement />
      ) : activeTab === 'payroll' ? (
        <PayrollTab />
      ) : activeTab === 'photos' ? (
        <PhotosTab />
      ) : activeTab === 'settings' ? (
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-brand" />
              Company Settings
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Logo Section */}
            <div className="md:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 text-center hover:shadow-3d-hover transition-all duration-300">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Company Logo</h3>
                <div className="relative group mx-auto w-full max-w-[280px] h-32 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden mb-4">
                  {settings?.logo_url ? (
                    <img src={settings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-slate-300" />
                  )}
                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-brand animate-spin" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-200 transition inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {settings?.logo_url ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                </label>
                <p className="text-[10px] text-slate-400 mt-4 uppercase font-bold">Recommended: Square PNG/JPG</p>
              </div>

              {/* App Icon Section */}
              <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 text-center mt-8 hover:shadow-3d-hover transition-all duration-300">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">App Icon</h3>
                <div className="relative group mx-auto w-16 h-16 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden mb-4">
                  {settings?.app_icon_url ? (
                    <img src={settings.app_icon_url} alt="App Icon" className="w-full h-full object-contain" />
                  ) : (
                    <Lightbulb className="w-8 h-8 text-slate-300" />
                  )}
                  {isUploadingAppIcon && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-brand animate-spin" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-200 transition inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {settings?.app_icon_url ? 'Change Icon' : 'Upload Icon'}
                  <input type="file" className="hidden" accept="image/*" onChange={handleAppIconUpload} disabled={isUploadingAppIcon} />
                </label>
                <p className="text-[10px] text-slate-400 mt-4 uppercase font-bold">Used in header & login</p>
              </div>

              {/* Google Drive Integration Section */}
              <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 mt-8 hover:shadow-3d-hover transition-all duration-300">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Storage Integration</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${googleStatus.companyConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Company Google Drive</p>
                        <p className="text-xs text-slate-500">
                          {googleStatus.companyConnected 
                            ? 'All photos will be saved to the company drive.' 
                            : 'Connect a central drive for all job photos.'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleConnectCompanyGoogle}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                        googleStatus.companyConnected 
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                          : 'bg-brand text-white hover:bg-brand-hover'
                      }`}
                    >
                      {googleStatus.companyConnected ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                      {googleStatus.companyConnected ? 'Connected' : 'Connect Drive'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">
                    When connected, photos uploaded by any technician will go to this central account.
                  </p>
                </div>
              </div>

              {/* Google Calendar Integration Section */}
              <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 mt-8 hover:shadow-3d-hover transition-all duration-300">
                <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Calendar Integration</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${googleStatus.calendarConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Google Calendar</p>
                        <p className="text-xs text-slate-500">
                          {googleStatus.calendarConnected 
                            ? 'Connected to Google Calendar API.' 
                            : 'Connect to sync job updates to calendars.'}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={handleConnectCalendar}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                        googleStatus.calendarConnected 
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                          : 'bg-brand text-white hover:bg-brand-hover'
                      }`}
                    >
                      {googleStatus.calendarConnected ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                      {googleStatus.calendarConnected ? 'Connected' : 'Connect Calendar'}
                    </button>
                  </div>

                  {googleStatus.calendarConnected && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">User Calendar Mapping</h4>
                      <div className="space-y-2">
                        {allUsers.filter(u => u.role === 'tech').map(user => (
                          <div key={user.id} className="flex items-center justify-between gap-4 p-2 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-sm font-medium text-slate-700">{user.username}</span>
                            <select
                              value={user.google_calendar_id || ''}
                              onChange={(e) => handleUpdateUserCalendar(user.id!, e.target.value)}
                              className="text-xs border border-slate-200 rounded p-1 bg-white focus:ring-1 focus:ring-brand outline-none max-w-[150px]"
                            >
                              <option value="">No Calendar</option>
                              {calendars.map(cal => (
                                <option key={cal.id} value={cal.id}>{cal.summary}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-[10px] text-slate-400 uppercase font-bold">
                    Connect your main Google account, then assign specific calendars to each technician.
                  </p>
                </div>
              </div>
            </div>

            {/* Info Section */}
            <div className="md:col-span-2">
              <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 space-y-6 hover:shadow-3d-hover transition-all duration-300">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Company Name</label>
                    <input 
                      type="text" 
                      value={settings?.company_name || ''} 
                      onChange={e => setSettings(prev => prev ? { ...prev, company_name: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Business Address</label>
                    <textarea 
                      value={settings?.address || ''} 
                      onChange={e => setSettings(prev => prev ? { ...prev, address: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand outline-none h-20"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Phone Number</label>
                      <input 
                        type="text" 
                        value={settings?.phone || ''} 
                        onChange={e => setSettings(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                      <input 
                        type="email" 
                        value={settings?.email || ''} 
                        onChange={e => setSettings(prev => prev ? { ...prev, email: e.target.value } : null)}
                        className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">HST/Tax Number</label>
                    <input 
                      type="text" 
                      value={settings?.hst_number || ''} 
                      onChange={e => setSettings(prev => prev ? { ...prev, hst_number: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand outline-none"
                      placeholder="e.g. 12345 6789 RT0001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Payment Info / Terms</label>
                    <textarea 
                      value={settings?.payment_info || ''} 
                      onChange={e => setSettings(prev => prev ? { ...prev, payment_info: e.target.value } : null)}
                      className="w-full p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand outline-none h-24"
                      placeholder="e.g. E-transfers can be sent to pay@example.com"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button 
                    type="submit"
                    disabled={isSavingSettings}
                    className="bg-brand text-white px-8 py-2.5 rounded-lg font-bold hover:bg-brand-hover transition shadow-lg shadow-brand/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSavingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : activeTab === 'photos' ? (
        <PhotosTab />
      ) : activeTab === 'estimates' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-brand" />
              Estimates
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Sort By:</label>
                <select 
                  value={estimateSortBy} 
                  onChange={(e) => setEstimateSortBy(e.target.value as any)}
                  className="text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-brand outline-none"
                >
                  <option value="date">Date</option>
                  <option value="expired">Expired</option>
                  <option value="accepted">Accepted</option>
                </select>
              </div>
              <button 
                onClick={() => { setEditingEstimate(null); setShowEstimateCreator(true); }}
                className="bg-brand text-white px-4 py-2 rounded-xl font-medium hover:bg-brand-hover transition-all shadow-md hover:shadow-lg active:translate-y-0.5 flex items-center gap-2"
              >
                <PlusCircle className="w-5 h-5" />
                New Estimate
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Active Estimates
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {(() => {
                const filtered = estimates.filter(e => e.status !== 'Declined');
                const sorted = [...filtered].sort((a, b) => {
                  if (estimateSortBy === 'date') {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  }
                  if (estimateSortBy === 'accepted') {
                    if (a.status === 'Accepted' && b.status !== 'Accepted') return -1;
                    if (a.status !== 'Accepted' && b.status === 'Accepted') return 1;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  }
                  if (estimateSortBy === 'expired') {
                    const isExpired = (e: Estimate) => {
                      const expiryDate = new Date(new Date(e.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);
                      return expiryDate < new Date() && e.status !== 'Accepted';
                    };
                    const aExp = isExpired(a);
                    const bExp = isExpired(b);
                    if (aExp && !bExp) return -1;
                    if (!aExp && bExp) return 1;
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                  }
                  return 0;
                });

                if (sorted.length === 0) {
                  return (
                    <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
                      <p className="text-slate-500">No active estimates found.</p>
                    </div>
                  );
                }

                return sorted.map(estimate => {
                  const expiryDate = new Date(new Date(estimate.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);
                  const isExpired = expiryDate < new Date() && estimate.status !== 'Accepted';

                  return (
                    <div key={estimate.id} className={`bg-white p-4 rounded-2xl shadow-3d border ${isExpired ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'} flex justify-between items-center hover:shadow-3d-hover hover:-translate-y-1 transition-all duration-300`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-800">{estimate.customer_name}</h4>
                          {isExpired && (
                            <span className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Expired</span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{estimate.job_address || 'Standalone Estimate'}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Estimate #{estimate.id} • Booked {new Date(estimate.created_at).toLocaleDateString()}
                          <span className="mx-2">•</span>
                          Valid until {expiryDate.toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="text-xl font-bold text-slate-900">${estimate.amount.toFixed(2)}</p>
                          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                            estimate.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {estimate.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={async () => {
                              const res = await apiFetch(`/api/estimates/${estimate.id}`);
                              const data = await res.json();
                              setEditingEstimate(data);
                              setShowEstimateCreator(true);
                            }}
                            className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition"
                            title="Edit Estimate"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => setViewingEstimateId(estimate.id)}
                            className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition"
                            title="View Estimate"
                          >
                            <FileText className="w-6 h-6" />
                          </button>
                          <button 
                            onClick={() => handleDeleteEstimate(estimate.id)}
                            className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition"
                            title="Delete Estimate"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Declined Section */}
          <div className="space-y-4 pt-8 border-t border-slate-200">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-brand" />
              Declined Estimates
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {estimates.filter(e => e.status === 'Declined').length === 0 ? (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
                  <p className="text-slate-500">No declined estimates.</p>
                </div>
              ) : (
                estimates.filter(e => e.status === 'Declined').map(estimate => (
                  <div key={estimate.id} className="bg-brand-light p-4 rounded-xl shadow-sm border border-brand/20 flex justify-between items-center opacity-75">
                    <div>
                      <h4 className="font-bold text-brand-hover">{estimate.customer_name}</h4>
                      <p className="text-sm text-brand">{estimate.job_address || 'Standalone Estimate'}</p>
                      <p className="text-xs text-brand/70 mt-1">Estimate #{estimate.id} • {new Date(estimate.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-xl font-bold text-brand-hover">${estimate.amount.toFixed(2)}</p>
                        <span className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-brand/20 text-brand-hover">
                          DECLINED
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setViewingEstimateId(estimate.id)}
                          className="p-2 text-brand/60 hover:text-brand hover:bg-brand-light rounded transition"
                          title="View Estimate"
                        >
                          <FileText className="w-6 h-6" />
                        </button>
                        <button 
                          onClick={() => handleDeleteEstimate(estimate.id)}
                          className="p-2 text-brand/60 hover:text-brand hover:bg-brand-light rounded transition"
                          title="Delete Estimate"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'invoices' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-brand" />
              Invoices
            </h2>
            <button 
              onClick={() => setShowStandaloneInvoice(true)}
              className="bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-hover transition flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" />
              New Standalone Invoice
            </button>
          </div>

          {/* Pending Invoices Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Pending Invoices
              {jobsWithoutInvoices.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                  {jobsWithoutInvoices.length}
                </span>
              )}
            </h3>
            
            {jobsWithoutInvoices.length === 0 ? (
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center">
                <p className="text-slate-500 text-sm">No completed jobs waiting for invoices.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {jobsWithoutInvoices.map(job => (
                  <div key={job.id} className="bg-white p-4 rounded-2xl shadow-3d border-l-4 border-l-amber-400 border-slate-200 flex justify-between items-center group hover:shadow-3d-hover transition-all duration-300">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800">{job.customer_name}</h4>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold">Job #{job.id}</span>
                      </div>
                      <p className="text-sm text-slate-500">{job.address}</p>
                      <p className="text-xs text-slate-400 mt-1">Completed on {new Date(job.updated_at || job.created_at).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={() => setCreatingInvoiceFor(job)}
                      className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-hover transition flex items-center gap-2 shadow-sm"
                    >
                      <Receipt className="w-4 h-4" />
                      Create Invoice
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-slate-200" />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Invoice History
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {!Array.isArray(invoices) || invoices.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl shadow-3d border border-slate-200 text-center hover:shadow-3d-hover transition-all duration-300">
                  <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-800 mb-2">No Invoices Yet</h3>
                  <p className="text-slate-500">Completed jobs will appear here for invoicing.</p>
                </div>
              ) : (
                invoices.map(invoice => (
                  <div key={invoice.id} className="bg-white p-4 rounded-2xl shadow-3d border border-slate-200 flex justify-between items-center hover:shadow-3d-hover transition-all duration-300">
                    <div>
                      <h4 className="font-bold text-slate-800">{invoice.customer_name}</h4>
                      <p className="text-sm text-slate-500">{invoice.job_address}</p>
                      <p className="text-xs text-slate-400 mt-1">Invoice #{invoice.id} • {new Date(invoice.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-xl font-bold text-slate-900">${invoice.amount.toFixed(2)}</p>
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${
                          invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={async () => {
                            const res = await apiFetch(`/api/invoices/${invoice.id}`);
                            const data = await res.json();
                            let jobData = undefined;
                            if (invoice.job_id) {
                              try {
                                const jobRes = await apiFetch(`/api/jobs/${invoice.job_id}`);
                                jobData = await jobRes.json();
                              } catch (e) {
                                console.error('Failed to fetch job for invoice edit:', e);
                              }
                            }
                            setEditingInvoice({ job: jobData as Job, invoice: data });
                          }}
                          className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition"
                          title="Edit Invoice"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setViewingInvoiceId(invoice.id)}
                          className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition"
                          title="View Invoice"
                        >
                          <Receipt className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'customers' ? (
        <CustomersTab />
      ) : (
        <div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-brand" />
              Job Management
            </h2>
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <label className="text-sm font-medium text-slate-600">Sort By:</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="text-sm border border-slate-200 rounded-lg p-2 bg-white focus:ring-2 focus:ring-brand outline-none flex-1 sm:flex-none"
                >
                  <option value="booked">Booked</option>
                  <option value="tech">By Tech</option>
                  <option value="date">Date</option>
                </select>
              </div>
              <button 
                onClick={() => { resetForm(); setShowForm(!showForm); }}
                className="bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-hover transition flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto"
              >
                <PlusCircle className="w-5 h-5" />
                New Job
              </button>
            </div>
          </div>

          {Array.isArray(jobsWithoutInvoices) && jobsWithoutInvoices.length > 0 && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl shadow-3d flex items-center justify-between animate-pulse hover:shadow-3d-hover transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 p-2 rounded-lg">
                  <Receipt className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-amber-900">Pending Invoices</p>
                  <p className="text-sm text-amber-700">You have {jobsWithoutInvoices.length} completed jobs ready for billing.</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveTab('invoices')}
                className="text-sm font-bold text-amber-900 hover:underline"
              >
                View All
              </button>
            </div>
          )}

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          <h3 className="text-lg font-semibold mb-4">{editingJobId ? 'Edit Job' : 'Create New Job'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Customer</label>
                <select 
                  value={customerId} 
                  onChange={handleCustomerSelect}
                  className="w-full p-2 border border-slate-300 rounded bg-white"
                >
                  <option value="new">-- New Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Job Site</label>
                  <select 
                    value={selectedJobSiteId || ''} 
                    onChange={(e) => setSelectedJobSiteId(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                    disabled={jobSites.length === 0}
                  >
                    <option value="">{jobSites.length > 0 ? '-- Select Job Site --' : '-- No Job Sites Available --'}</option>
                    {jobSites.map(js => (
                      <option key={js.id} value={js.id}>{js.name} - {js.address}</option>
                    ))}
                  </select>
                </div>
                {customerId === 'new' && (
                  <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm font-medium text-slate-700">Add Job Site for New Customer</label>
                    <input type="text" value={newJobSiteName} onChange={e => setNewJobSiteName(e.target.value)} placeholder="Job Site Name" className="w-full p-2 border border-slate-300 rounded" />
                    <input type="text" value={newJobSiteAddress} onChange={e => setNewJobSiteAddress(e.target.value)} placeholder="Job Site Address" className="w-full p-2 border border-slate-300 rounded" />
                  </div>
                )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                <input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-2 border border-slate-300 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 border border-slate-300 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border border-slate-300 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <AddressAutocomplete 
                  required 
                  value={address} 
                  onChange={setAddress} 
                  className="w-full p-2 border border-slate-300 rounded" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full p-2 border border-slate-300 rounded">
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Type</label>
                <select value={jobType} onChange={e => setJobType(e.target.value)} className="w-full p-2 border border-slate-300 rounded">
                  <option value="New Build">New Build</option>
                  <option value="Service Call">Service Call</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Warranty">Warranty</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Assign To</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {techs.map(t => (
                    <label key={t.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                      <input 
                        type="checkbox" 
                        checked={assignedTechs.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignedTechs([...assignedTechs, t.id]);
                          } else {
                            setAssignedTechs(assignedTechs.filter(id => id !== t.id));
                          }
                        }}
                        className="rounded text-brand focus:ring-brand"
                      />
                      <span className="text-sm text-slate-700">{t.username}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Date</label>
                <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded" />
              </div>

              {editingJobId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className="w-full p-2 border border-slate-300 rounded">
                    <option value="New">New</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending Parts">Pending Parts</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Job Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border border-slate-300 rounded h-24" />
              </div>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Tasks</label>
              {tasks.map((task, index) => (
                <div key={index} className="flex gap-2 mb-2 items-center">
                  <input 
                    type="text" 
                    value={task.description} 
                    onChange={e => handleTaskChange(index, e.target.value)} 
                    placeholder="Task description"
                    className="flex-1 p-2 border border-slate-300 rounded"
                  />
                  <button 
                    type="button" 
                    onClick={() => handleRemoveTask(index)}
                    className="p-2 text-brand hover:bg-brand-light rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={handleAddTask} className="text-sm text-brand font-medium mt-1 flex items-center gap-1">
                <PlusCircle className="w-4 h-4" /> Add task
              </button>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover">
                {editingJobId ? 'Save Changes' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Open Jobs</h3>
          <span className="text-xs text-slate-500 font-medium">{jobs.length} total</span>
        </div>
        <ul className="divide-y divide-slate-200">
          {jobs.length === 0 ? (
            <li className="p-6 text-center text-slate-500">No open jobs found.</li>
          ) : (
            [...jobs].sort((a, b) => {
              if (sortBy === 'tech') {
                return (a.assigned_to_name || '').localeCompare(b.assigned_to_name || '');
              } else if (sortBy === 'date') {
                if (!a.scheduled_date) return 1;
                if (!b.scheduled_date) return -1;
                return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
              } else {
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              }
            }).map(job => (
              <li key={job.id} className="p-4 hover:bg-slate-50 transition flex justify-between items-center group">
                <Link to={`/job/${job.id}`} className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-brand text-lg">{job.customer_name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityColor(job.priority)}`}>
                      {job.priority}
                    </span>
                    {job.job_type && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800">
                        {job.job_type}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(job.status)}`}>
                      {job.status}
                    </span>
                    {job.scheduled_date && (
                      <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">
                        Scheduled: {job.scheduled_date}
                      </span>
                    )}
                    {job.status === 'Completed' && Array.isArray(jobsWithoutInvoices) && jobsWithoutInvoices.some(j => j.id === job.id) && (
                      <span className="bg-brand-light text-brand text-[10px] uppercase font-bold px-2 py-0.5 rounded animate-bounce">
                        Needs Invoice
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{job.address}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Assigned to: {job.assigned_to_name || 'Unassigned'} | Added {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </Link>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button 
                      onClick={() => setViewingWorkOrderId(job.id)}
                      className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded"
                      title="View Work Order"
                    >
                      <Receipt className="w-5 h-5" />
                    </button>
                    {job.status === 'Completed' && Array.isArray(jobsWithoutInvoices) && jobsWithoutInvoices.some(j => j.id === job.id) && (
                      <button 
                        onClick={() => setCreatingInvoiceFor(job)}
                        className="p-2 text-brand hover:bg-brand-light rounded flex items-center gap-1 font-bold text-xs"
                        title="Create Invoice"
                      >
                        <Receipt className="w-5 h-5" />
                        Invoice
                      </button>
                    )}
                  <button onClick={() => handleRescheduleClick(job)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded" title="Reschedule">
                    <Calendar className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleEdit(job)} className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded" title="Edit">
                    <Edit className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(job.id)} className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded" title="Delete">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Reschedule Modal */}
      {reschedulingJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h3 className="font-bold text-lg text-slate-800">Reschedule Job</h3>
              <button onClick={() => setReschedulingJob(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRescheduleSubmit} className="p-4 space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                Rescheduling job for <span className="font-semibold text-slate-800">{reschedulingJob.customer_name}</span>
              </p>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Assign To</label>
                <div className="grid grid-cols-2 gap-2">
                  {techs.map(t => (
                    <label key={t.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded cursor-pointer hover:bg-slate-50">
                      <input 
                        type="checkbox" 
                        checked={rescheduleTechs.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setRescheduleTechs([...rescheduleTechs, t.id]);
                          } else {
                            setRescheduleTechs(rescheduleTechs.filter(id => id !== t.id));
                          }
                        }}
                        className="rounded text-brand focus:ring-brand"
                      />
                      <span className="text-sm text-slate-700">{t.username}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Date</label>
                <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-brand outline-none" />
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setReschedulingJob(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded font-medium">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover font-medium">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
        </div>
      )}
      </div>

      {creatingInvoiceFor && (
        <InvoiceCreator 
          job={creatingInvoiceFor} 
          onClose={() => setCreatingInvoiceFor(null)} 
          onCreated={() => {
            fetchInvoices();
            fetchJobsWithoutInvoices();
            fetchJobs();
          }}
        />
      )}

      {editingInvoice && (
        <InvoiceCreator 
          job={editingInvoice.job} 
          invoice={editingInvoice.invoice}
          onClose={() => setEditingInvoice(null)} 
          onCreated={() => {
            fetchInvoices();
            fetchJobsWithoutInvoices();
            fetchJobs();
          }}
        />
      )}

      {viewingInvoiceId && (
        <InvoiceView 
          invoiceId={viewingInvoiceId} 
          onClose={() => setViewingInvoiceId(null)} 
          onEdit={async (invoice) => {
            let jobData = undefined;
            if (invoice.job_id) {
              try {
                const jobRes = await apiFetch(`/api/jobs/${invoice.job_id}`);
                jobData = await jobRes.json();
              } catch (e) {
                console.error('Failed to fetch job for invoice edit:', e);
              }
            }
            setViewingInvoiceId(null);
            setEditingInvoice({ job: jobData as Job, invoice });
          }}
        />
      )}

      {viewingWorkOrderId && (
        <WorkOrderView 
          jobId={viewingWorkOrderId} 
          onClose={() => setViewingWorkOrderId(null)} 
        />
      )}

      {showStandaloneInvoice && (
        <InvoiceCreator 
          onClose={() => setShowStandaloneInvoice(false)} 
          onCreated={() => {
            fetchInvoices();
            fetchJobsWithoutInvoices();
            fetchJobs();
          }}
        />
      )}

      {showEstimateCreator && (
        <EstimateCreator 
          onClose={() => setShowEstimateCreator(false)}
          onCreated={() => fetchEstimates()}
        />
      )}

      {editingEstimate && (
        <EstimateCreator 
          estimate={editingEstimate}
          onClose={() => setEditingEstimate(null)}
          onCreated={() => fetchEstimates()}
        />
      )}

      {viewingEstimateId && (
        <EstimateView 
          estimateId={viewingEstimateId}
          onClose={() => setViewingEstimateId(null)}
          onEdit={(est) => {
            setViewingEstimateId(null);
            setEditingEstimate(est);
          }}
          onAccept={handleAcceptEstimate}
          onDecline={handleDeclineEstimate}
        />
      )}
    </div>
    </div>
  );
}
