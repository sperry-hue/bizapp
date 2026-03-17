import React, { useState, useEffect } from 'react';
import { Job, User } from '../types';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Phone, Calendar, User as UserIcon, WifiOff, Clock, Navigation, MessageSquare, DollarSign, Plus } from 'lucide-react';
import localforage from 'localforage';
import { apiFetch } from '../services/api';
import TechPayrollTab from './TechPayrollTab';
import SubmitShiftModal from './SubmitShiftModal';

const formatScheduledDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const scheduledDate = new Date(year, month - 1, day);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  
  const scheduledTime = scheduledDate.getTime();
  const todayTime = today.getTime();
  const tomorrowTime = tomorrow.getTime();
  
  if (scheduledTime === todayTime) {
    return 'Today';
  } else if (scheduledTime === tomorrowTime) {
    return 'Tomorrow';
  } else {
    return scheduledDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }
};

export default function TechDashboard({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'payroll'>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [customers, setCustomers] = useState<{id: number, name: string}[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [jobSites, setJobSites] = useState<{id: number, name: string}[]>([]);
  const [selectedJobSiteId, setSelectedJobSiteId] = useState<string>('');
  const [closedJobs, setClosedJobs] = useState<Job[]>([]);
  const [loadingClosedJobs, setLoadingClosedJobs] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await apiFetch('/api/customers');
        const data = await res.json();
        setCustomers(data);
      } catch (e) {
        console.error('Failed to fetch customers:', e);
      }
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    const fetchJobSites = async () => {
      if (!selectedCustomerId) {
        setJobSites([]);
        setSelectedJobSiteId('');
        return;
      }
      try {
        const res = await apiFetch(`/api/customers/${selectedCustomerId}/job-sites`);
        const data = await res.json();
        setJobSites(data);
      } catch (e) {
        console.error('Failed to fetch job sites:', e);
      }
    };
    fetchJobSites();
  }, [selectedCustomerId]);

  useEffect(() => {
    const fetchClosedJobs = async () => {
      if (!selectedCustomerId) {
        setClosedJobs([]);
        return;
      }
      setLoadingClosedJobs(true);
      try {
        let url = `/api/customers/${selectedCustomerId}/jobs`;
        const res = await apiFetch(url);
        const allJobs = await res.json();
        let closed = allJobs.filter((j: Job) => j.status === 'Completed');
        
        if (selectedJobSiteId) {
          closed = closed.filter((j: Job) => j.job_site_id === parseInt(selectedJobSiteId));
        }
        
        // Fetch details for each closed job to get photos
        const jobsWithDetails = await Promise.all(closed.map(async (job: Job) => {
          const res = await apiFetch(`/api/jobs/${job.id}`);
          return await res.json();
        }));
        
        setClosedJobs(jobsWithDetails);
      } catch (e) {
        console.error('Failed to fetch closed jobs:', e);
      } finally {
        setLoadingClosedJobs(false);
      }
    };
    fetchClosedJobs();
  }, [selectedCustomerId, selectedJobSiteId]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const loadJobs = async () => {
      try {
        if (navigator.onLine) {
          const res = await apiFetch(`/api/jobs?tech_id=${user.id}`);
          const data = await res.json();
          setJobs(data);
          await localforage.setItem(`tech_jobs_${user.id}`, data);
        } else {
          const cachedJobs = await localforage.getItem<Job[]>(`tech_jobs_${user.id}`);
          if (cachedJobs) setJobs(cachedJobs);
        }
      } catch (e) {
        const cachedJobs = await localforage.getItem<Job[]>(`tech_jobs_${user.id}`);
        if (cachedJobs) setJobs(cachedJobs);
      } finally {
        setLoading(false);
      }
    };

    loadJobs();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user.id]);

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'Urgent': return 'bg-brand-light text-brand';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-brand-light text-brand';
      case 'Low': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const sortJobs = (a: Job, b: Job) => {
    if (a.scheduled_date && b.scheduled_date) {
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    }
    if (a.scheduled_date && !b.scheduled_date) return -1;
    if (!a.scheduled_date && b.scheduled_date) return 1;
    
    return a.customer_name.localeCompare(b.customer_name);
  };

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const todaysJobs = jobs.filter(j => j.scheduled_date && j.scheduled_date <= todayStr).sort(sortJobs);
  const futureJobs = jobs.filter(j => !j.scheduled_date || j.scheduled_date > todayStr).sort(sortJobs);

  const renderJobCard = (job: Job) => (
    <Link 
      key={job.id} 
      to={`/job/${job.id}`}
      className="bg-white rounded-2xl shadow-3d border border-slate-200 p-6 hover:shadow-3d-hover hover:-translate-y-1 transition-all duration-300 group block relative overflow-hidden"
    >
      <div className={`absolute top-0 left-0 w-1 h-full ${job.priority === 'Urgent' ? 'bg-brand' : job.priority === 'High' ? 'bg-orange-500' : 'bg-transparent'}`} />
      
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold text-slate-800 group-hover:text-brand transition">{job.customer_name}</h3>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPriorityColor(job.priority)}`}>
            {job.priority}
          </span>
          <span className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-full font-medium">
            {job.status}
          </span>
        </div>
      </div>
      
      <div className="space-y-3 text-sm text-slate-600">
        {job.scheduled_date && (
          <div className="flex items-center gap-2 bg-amber-50 text-amber-800 p-2 rounded-lg font-medium border border-amber-200">
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Scheduled: {formatScheduledDate(job.scheduled_date)}</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <span>{job.address}</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`, '_blank');
            }}
            className="p-1.5 bg-brand-light text-brand rounded-lg hover:bg-brand/10 transition shadow-sm border border-brand/10 flex items-center gap-1 text-[10px] font-bold shrink-0"
            title="Get Directions"
          >
            <Navigation className="w-3 h-3" />
            MAP
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{job.phone}</span>
        </div>
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-slate-400 shrink-0" />
          <span>{job.assigned_to_name ? `Assigned to ${job.assigned_to_name}` : 'Unassigned'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Added {new Date(job.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      
      <div className="mt-6 pt-4 border-t border-slate-100 text-brand font-medium text-sm flex items-center justify-between">
        View Job Details
        <span className="bg-brand-light text-brand rounded-full w-8 h-8 flex items-center justify-center group-hover:bg-brand/10 transition">
          →
        </span>
      </div>
    </Link>
  );

  if (loading) return <div className="p-8 text-center text-slate-500">Loading jobs...</div>;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 bg-white p-1.5 rounded-2xl shadow-3d border border-slate-200">
            <button
              onClick={() => setActiveTab('jobs')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-300 ${
                activeTab === 'jobs' 
                  ? 'bg-brand text-white shadow-lg' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Briefcase className="w-5 h-5" />
              Jobs
            </button>
            <button
              onClick={() => setActiveTab('payroll')}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all duration-300 ${
                activeTab === 'payroll' 
                  ? 'bg-brand text-white shadow-lg' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              Payroll
            </button>
          </div>
          <button
            onClick={() => setShowShiftModal(true)}
            className="flex items-center gap-2 bg-brand text-white px-6 py-3 rounded-2xl font-bold hover:bg-brand/90 transition-all shadow-3d hover:shadow-3d-hover active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Add Shift</span>
            <span className="sm:hidden">Shift</span>
          </button>
        </div>

        {isOffline && (
          <span className="flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
            <WifiOff className="w-4 h-4" /> Offline Mode
          </span>
        )}
      </div>

      {activeTab === 'payroll' ? (
        <TechPayrollTab key={refreshTrigger} />
      ) : (
        <div className="space-y-8">
          {/* Team Chat Section */}
          <div className="mb-2">
            <Link 
              to="/chat"
              className="flex items-center justify-between p-5 bg-white rounded-2xl shadow-3d border border-slate-200 hover:shadow-3d-hover hover:-translate-y-1 transition-all duration-300 group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-light rounded-xl flex items-center justify-center text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Team Chat</h3>
                  <p className="text-sm text-slate-500">Message the office or other technicians</p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-brand font-bold">
                <span>Open Chat</span>
                <span className="bg-brand-light text-brand rounded-full w-8 h-8 flex items-center justify-center group-hover:bg-brand group-hover:text-white transition-all">
                  →
                </span>
              </div>
              <div className="sm:hidden text-brand">
                <MessageSquare className="w-5 h-5" />
              </div>
            </Link>
          </div>

          {/* Today's Jobs */}
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand" />
              Today's Jobs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {todaysJobs.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-3d">
                  <p className="text-slate-500">No jobs scheduled for today.</p>
                </div>
              ) : (
                todaysJobs.map(renderJobCard)
              )}
            </div>
          </div>

          {/* Future & Unscheduled Jobs */}
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand" />
              Future & Unscheduled Jobs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {futureJobs.length === 0 ? (
                <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-3d">
                  <p className="text-slate-500">No future or unscheduled jobs.</p>
                </div>
              ) : (
                futureJobs.map(renderJobCard)
              )}
            </div>
          </div>

          {/* Closed Jobs Search */}
          <div>
            <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-brand" />
              Closed Jobs Search
            </h3>
            <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2">Select Customer</label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none bg-white mb-4"
              >
                <option value="">Select a customer...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              
              {selectedCustomerId && (
                <>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Select Job Site</label>
                  <select
                    value={selectedJobSiteId}
                    onChange={e => setSelectedJobSiteId(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none bg-white"
                  >
                    <option value="">All Job Sites</option>
                    {jobSites.map(js => (
                      <option key={js.id} value={js.id}>{js.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {loadingClosedJobs ? (
              <p className="text-center text-slate-500">Loading closed jobs...</p>
            ) : closedJobs.length > 0 ? (
              <div className="space-y-6">
                {closedJobs.map(job => (
                  <div key={job.id} className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200">
                    <h4 className="text-lg font-bold text-slate-800 mb-2">{job.customer_name} - {new Date(job.created_at).toLocaleDateString()}</h4>
                    <p className="text-sm text-slate-600 mb-4">{job.address}</p>
                    
                    <h5 className="text-sm font-bold text-slate-700 mb-2">Photos</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {job.photos && job.photos.map((photo: any) => (
                        <img key={photo.id} src={photo.drive_url || photo.local_path} alt="Job photo" className="w-full h-32 object-cover rounded-lg" referrerPolicy="no-referrer" />
                      ))}
                      {(!job.photos || job.photos.length === 0) && <p className="text-sm text-slate-500 italic">No photos uploaded.</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : selectedCustomerId && <p className="text-center text-slate-500">No closed jobs found for this customer.</p>}
          </div>
        </div>
      )}

      <SubmitShiftModal 
        isOpen={showShiftModal} 
        onClose={() => setShowShiftModal(false)} 
        onSuccess={() => setRefreshTrigger(prev => prev + 1)} 
      />
    </div>
  );
}
