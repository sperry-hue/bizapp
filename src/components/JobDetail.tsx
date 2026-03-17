import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Job, Task, JobUpdate, Photo, User } from '../types';
import { CheckCircle2, Circle, Upload, MapPin, Phone, Calendar, Clock, FileText, CheckSquare, Image as ImageIcon, Check, WifiOff, User as UserIcon, Mic, Wand2, Loader2, Receipt, ArrowLeft, X, Navigation } from 'lucide-react';
import localforage from 'localforage';
import { enqueueAction, getLastSyncTime } from '../services/syncService';
import { GoogleGenAI, Type } from "@google/genai";
import { apiFetch } from '../services/api';
import InvoiceCreator from './InvoiceCreator';
import InvoiceView from './InvoiceView';
import WorkOrderView from './WorkOrderView';
import PhotoComments from './PhotoComments';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export default function JobDetail({ user }: { user: User }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [companyGoogleConnected, setCompanyGoogleConnected] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [lastSync, setLastSync] = useState<number | null>(null);
  
  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeOnSite, setTimeOnSite] = useState(new Date().toTimeString().slice(0, 5));
  const [timeOffSite, setTimeOffSite] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000).toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');
  const [materials, setMaterials] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showInvoiceCreator, setShowInvoiceCreator] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<{ job: Job, invoice: any } | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [viewingWorkOrderId, setViewingWorkOrderId] = useState<number | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    fetchJobData();
    checkGoogleAuth();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id]);

  useEffect(() => {
    const photoId = searchParams.get('photo');
    if (photoId && photos.length > 0) {
      const photo = photos.find(p => p.id === parseInt(photoId));
      if (photo) setViewingPhoto(photo);
    }
  }, [searchParams, photos]);

  const fetchJobData = async () => {
    try {
      if (navigator.onLine) {
        const res = await apiFetch(`/api/jobs/${id}`);
        const data = await res.json();
        setJob(data);
        setTasks(data.tasks || []);
        setUpdates(data.updates || []);
        setPhotos(data.photos || []);
        await localforage.setItem(`job_${id}`, data);
      } else {
        const cachedData = await localforage.getItem<any>(`job_${id}`);
        if (cachedData) {
          setJob(cachedData);
          setTasks(cachedData.tasks || []);
          setUpdates(cachedData.updates || []);
          setPhotos(cachedData.photos || []);
        }
      }
    } catch (e) {
      const cachedData = await localforage.getItem<any>(`job_${id}`);
      if (cachedData) {
        setJob(cachedData);
        setTasks(cachedData.tasks || []);
        setUpdates(cachedData.updates || []);
        setPhotos(cachedData.photos || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const checkGoogleAuth = () => {
    if (!navigator.onLine) return;
    apiFetch('/api/auth/google/status')
      .then(res => res.json())
      .then(data => {
        setGoogleConnected(data.connected);
        setCompanyGoogleConnected(data.companyConnected);
      })
      .catch(() => {});
  };

  const handleConnectGoogle = async () => {
    if (!navigator.onLine) {
      alert('Cannot connect to Google while offline.');
      return;
    }
    const res = await apiFetch('/api/auth/google/url');
    const data = await res.json();
    
    const authWindow = window.open(data.url, 'oauth_popup', 'width=600,height=700');
    
    if (!authWindow) {
      alert('Please allow popups for this site to connect your Google account.');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setGoogleConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const toggleTask = async (taskId: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: newStatus } : t));

    if (navigator.onLine) {
      try {
        await apiFetch(`/api/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ is_completed: newStatus })
        });
      } catch (e) {
        await enqueueAction({ type: 'TOGGLE_TASK', payload: { taskId, is_completed: newStatus } });
      }
    } else {
      await enqueueAction({ type: 'TOGGLE_TASK', payload: { taskId, is_completed: newStatus } });
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskDescription.trim()) return;
    
    setIsAddingTask(true);
    try {
      if (navigator.onLine) {
        const res = await apiFetch(`/api/jobs/${id}/tasks`, {
          method: 'POST',
          body: JSON.stringify({ description: newTaskDescription })
        });
        const data = await res.json();
        if (data.success) {
          setTasks([...tasks, { id: data.id, job_id: Number(id), description: newTaskDescription, is_completed: false }]);
          setNewTaskDescription('');
        }
      } else {
        // Offline task creation could be handled here if needed
        alert('Cannot add tasks while offline.');
      }
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task.');
    } finally {
      setIsAddingTask(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleListen = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      const newNotes = notes ? `${notes}\n${transcript}` : transcript;
      setNotes(newNotes);
      
      // Automatically extract after listening
      await extractTasksAndMaterials(transcript);
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert("Microphone access was denied. Please ensure you've granted permission in your browser and that the app is allowed to access the microphone.");
      } else {
        alert(`Speech recognition error: ${event.error}`);
      }
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
  };

  const extractTasksAndMaterials = async (textToProcess: string) => {
    if (!textToProcess.trim()) return;
    
    setIsExtracting(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract any tasks that need to be done and materials that were used or are needed from the following notes.
        Notes: "${textToProcess}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of tasks to be done."
              },
              materials: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of materials used or needed."
              }
            }
          }
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      // Add materials
      if (result.materials && result.materials.length > 0) {
        const newMaterials = result.materials.join(', ');
        setMaterials(prev => prev ? `${prev}, ${newMaterials}` : newMaterials);
      }
      
      // Add tasks
      if (result.tasks && result.tasks.length > 0) {
        for (const taskDesc of result.tasks) {
          await apiFetch(`/api/jobs/${id}/tasks`, {
            method: 'POST',
            body: JSON.stringify({ description: taskDesc })
          });
        }
        // Refresh tasks
        fetchJobData();
      }
    } catch (error) {
      console.error("Error extracting with Gemini:", error);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmitUpdate = async (e: React.FormEvent | React.MouseEvent, closeJob: boolean = false) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    
    if (!navigator.onLine) {
      // Offline mode handling
      const photosData = [];
      if (selectedFiles) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const base64 = await fileToBase64(selectedFiles[i]);
          photosData.push({ name: selectedFiles[i].name, data: base64 });
        }
      }

      await enqueueAction({
        type: 'ADD_UPDATE',
        payload: {
          jobId: id,
          date,
          time_on_site: timeOnSite,
          time_off_site: timeOffSite,
          notes,
          materials_used: materials,
          submit: 'true',
          photos: photosData
        }
      });

      if (closeJob) {
        await enqueueAction({
          type: 'UPDATE_STATUS',
          payload: { jobId: id, status: 'Completed' }
        });
        alert('Job closed offline. Changes will sync when online.');
        navigate(user.role === 'admin' ? '/admin' : '/tech');
      } else {
        alert('Update saved offline. Will sync when online.');
        setNotes('');
        setMaterials('');
        setSelectedFiles(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      setIsSubmitting(false);
      return;
    }
    
    // Online mode handling
    const formData = new FormData();
    formData.append('date', date);
    formData.append('time_on_site', timeOnSite);
    formData.append('time_off_site', timeOffSite);
    formData.append('notes', notes);
    formData.append('materials_used', materials);
    formData.append('submit', 'true'); // Always submit to create calendar event if tokens exist
    
    if (selectedFiles) {
      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('photos', selectedFiles[i]);
      }
    }
    
    try {
      const res = await apiFetch(`/api/jobs/${id}/updates`, {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        throw new Error('Failed to save update');
      }
      
      if (closeJob) {
        console.log('Closing job...', id);
        const statusRes = await apiFetch(`/api/jobs/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'Completed' })
        });
        
        if (!statusRes.ok) {
          const errorData = await statusRes.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to update job status');
        }

        console.log('Job closed successfully, navigating to:', user.role === 'admin' ? '/admin' : '/tech');
        navigate(user.role === 'admin' ? '/admin' : '/tech');
      } else {
        setNotes('');
        setMaterials('');
        setSelectedFiles(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchJobData();
        alert('Update submitted successfully! Calendar event created.');
      }
    } catch (error: any) {
      console.error('Error submitting update:', error);
      alert(`Failed to submit update: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
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

  if (loading) return <div className="p-8 text-center text-slate-500">Loading job details...</div>;
  if (!job) return <div className="p-8 text-center text-brand">Job not found.</div>;

  return (
    <div className="space-y-6">
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
      <div className="flex items-center">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 hover:text-brand transition font-bold text-sm uppercase tracking-wider bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Column: Job Info & Tasks */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 hover:shadow-3d-hover transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-slate-800">{job.customer_name}</h2>
            <div className="flex flex-col items-end gap-1">
              {isOffline && (
                <span className="flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs font-medium">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              )}
              {job.job_type && (
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  {job.job_type}
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(job.status)}`}>
                {job.status.toUpperCase()}
              </span>
            </div>
          </div>
          
          {user.role === 'admin' && job.status === 'Completed' && !job.invoice_id && (
            <div className="space-y-3 mb-6">
              <button 
                onClick={() => setViewingWorkOrderId(job.id)}
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2 border border-slate-200"
              >
                <FileText className="w-5 h-5" />
                View Work Order
              </button>
              <button 
                onClick={() => setShowInvoiceCreator(true)}
                className="w-full bg-brand text-white py-3 rounded-xl font-bold hover:bg-brand-hover transition flex items-center justify-center gap-2 shadow-lg shadow-brand/10"
              >
                <Receipt className="w-5 h-5" />
                Create Invoice
              </button>
            </div>
          )}

          {user.role === 'admin' && job.invoice_id && (
            <div className="space-y-3 mb-6">
              <button 
                onClick={() => setViewingWorkOrderId(job.id)}
                className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2 border border-slate-200"
              >
                <FileText className="w-5 h-5" />
                View Work Order
              </button>
              <button 
                onClick={() => setViewingInvoiceId(job.invoice_id!)}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
              >
                <Receipt className="w-5 h-5" />
                View Invoice
              </button>
            </div>
          )}
          
          {user.role !== 'admin' && (
            <button 
              onClick={() => setViewingWorkOrderId(job.id)}
              className="w-full mb-6 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-200 transition flex items-center justify-center gap-2 border border-slate-200"
            >
              <FileText className="w-5 h-5" />
              View Work Order
            </button>
          )}
          
          <div className="space-y-3 text-sm text-slate-600 mb-6">
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
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`, '_blank')}
                className="p-1.5 bg-brand-light text-brand rounded-lg hover:bg-brand/10 transition shadow-sm border border-brand/10 flex items-center gap-1 text-xs font-bold shrink-0"
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
          </div>
          
          {job.notes && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 mb-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Admin Notes
              </h4>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.notes}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 hover:shadow-3d-hover transition-all duration-300">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-brand" />
            Task List
          </h3>
          
          <form onSubmit={handleAddTask} className="mb-4 flex gap-2">
            <input
              type="text"
              value={newTaskDescription}
              onChange={(e) => setNewTaskDescription(e.target.value)}
              placeholder="Add a new task..."
              className="flex-1 p-2 text-sm border border-slate-300 rounded focus:ring-brand focus:border-brand"
              disabled={isAddingTask || isOffline}
            />
            <button
              type="submit"
              disabled={!newTaskDescription.trim() || isAddingTask || isOffline}
              className="px-3 py-2 bg-brand text-white text-sm font-medium rounded hover:bg-brand-hover disabled:opacity-50"
            >
              Add
            </button>
          </form>
          
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No tasks assigned.</p>
          ) : (
            <ul className="space-y-3">
              {tasks.map(task => (
                <li 
                  key={task.id} 
                  className={`flex items-start gap-3 p-3 rounded-lg border transition cursor-pointer ${task.is_completed ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-200 hover:border-brand/30'}`}
                  onClick={() => toggleTask(task.id, task.is_completed)}
                >
                  {task.is_completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />
                  )}
                  <span className={`text-sm ${task.is_completed ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                    {task.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right Column: Update Form & History */}
      <div className="lg:col-span-2 space-y-6">
        {job.status !== 'Completed' && (
          <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 hover:shadow-3d-hover transition-all duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Add Job Update</h3>
              {!googleConnected && !companyGoogleConnected && !isOffline && (
                <button 
                  onClick={handleConnectGoogle}
                  className="text-xs bg-brand-light text-brand px-3 py-1.5 rounded-full font-medium hover:bg-brand/10 transition flex items-center gap-1"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3 h-3" />
                  Connect Google (Drive & Calendar)
                </button>
              )}
              {companyGoogleConnected && !isOffline && (
                <span className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Company Drive Connected
                </span>
              )}
              {googleConnected && !companyGoogleConnected && !isOffline && (
                <span className="text-xs bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Google Connected
                </span>
              )}
            </div>
            
            <form className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-slate-400" /> Date
                  </label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-brand focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-slate-400" /> Time on Site
                  </label>
                  <input type="time" value={timeOnSite} onChange={e => setTimeOnSite(e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-brand focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-4 h-4 text-slate-400" /> Time off Site
                  </label>
                  <input type="time" value={timeOffSite} onChange={e => setTimeOffSite(e.target.value)} className="w-full p-2 border border-slate-300 rounded focus:ring-brand focus:border-brand" />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700">Work Notes</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleListen}
                      disabled={isListening || isExtracting}
                      className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${isListening ? 'bg-brand-light text-brand animate-pulse' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      title="Dictate notes and auto-extract tasks/materials"
                    >
                      <Mic className="w-3 h-3" />
                      {isListening ? 'Listening...' : 'Dictate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => extractTasksAndMaterials(notes)}
                      disabled={!notes.trim() || isExtracting || isListening}
                      className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      title="Extract tasks and materials from notes using AI"
                    >
                      {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      Extract
                    </button>
                  </div>
                </div>
                <textarea 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  className="w-full p-2 border border-slate-300 rounded h-24 focus:ring-brand focus:border-brand"
                  placeholder="What was done today? (Use the Dictate button to speak and auto-extract tasks & materials)"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Materials Used</label>
                <textarea 
                  value={materials} 
                  onChange={e => setMaterials(e.target.value)} 
                  className="w-full p-2 border border-slate-300 rounded h-16 focus:ring-brand focus:border-brand"
                  placeholder="List parts and materials used"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                  <ImageIcon className="w-4 h-4 text-slate-400" /> Upload Photos
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg hover:bg-slate-50 transition">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-slate-400" />
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-brand hover:text-brand-hover focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-brand">
                        <span>Upload files</span>
                        <input id="file-upload" name="file-upload" type="file" multiple className="sr-only" ref={fileInputRef} onChange={e => setSelectedFiles(e.target.files)} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, GIF up to 10MB</p>
                    {selectedFiles && selectedFiles.length > 0 && (
                      <p className="text-sm font-medium text-brand mt-2">{selectedFiles.length} file(s) selected</p>
                    )}
                  </div>
                </div>
                {!googleConnected && !isOffline && selectedFiles && selectedFiles.length > 0 && (
                  <p className="text-xs text-amber-600 mt-2">⚠️ Connect Google above to save photos to Drive.</p>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={(e) => handleSubmitUpdate(e, false)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-brand text-white rounded-lg font-medium hover:bg-brand-hover transition disabled:opacity-50 flex-1 sm:flex-none text-center"
                >
                  {isSubmitting ? 'Saving...' : (isOffline ? 'Save Offline' : 'Submit Update & Add to Calendar')}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowCloseConfirm(true)}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition disabled:opacity-50 flex-1 sm:flex-none text-center"
                >
                  {isSubmitting ? 'Closing...' : 'Close Job'}
                </button>
              </div>

              {showCloseConfirm && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-amber-800 font-medium">
                    Are you sure you want to close this job? It will be moved to completed status.
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      type="button"
                      onClick={() => setShowCloseConfirm(false)}
                      className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        setShowCloseConfirm(false);
                        handleSubmitUpdate(e, true);
                      }}
                      className="flex-1 sm:flex-none px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700"
                    >
                      Yes, Close Job
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {/* History Section */}
        <div className="bg-white p-6 rounded-2xl shadow-3d border border-slate-200 hover:shadow-3d-hover transition-all duration-300">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Job History & Photos</h3>
          
          {updates.length === 0 && photos.length === 0 ? (
            <p className="text-sm text-slate-500 italic text-center py-8">No updates or photos yet.</p>
          ) : (
            <div className="space-y-8">
              {/* Photos Grid */}
              {photos.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-3">Photos ({photos.length})</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {photos.map(photo => (
                      <button 
                        key={photo.id} 
                        onClick={() => setViewingPhoto(photo)}
                        className="block aspect-square bg-slate-100 rounded-lg border border-slate-200 overflow-hidden hover:opacity-80 transition flex items-center justify-center group relative"
                      >
                        {photo.local_path || photo.drive_url ? (
                          <img 
                            src={photo.local_path || (photo.drive_file_id ? `https://drive.google.com/uc?export=view&id=${photo.drive_file_id}` : photo.drive_url)} 
                            alt="Job thumbnail" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-400 group-hover:scale-110 transition" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <span className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded">View & Comment</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Updates Timeline */}
              {updates.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Updates</h4>
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {updates.map((update, index) => (
                      <div key={update.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-brand-light text-brand shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                          <span className="text-xs font-bold">{update.tech_name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-slate-800 text-sm">{update.tech_name}</span>
                            <span className="text-xs text-slate-500">
                              {update.date} at {update.time_on_site}
                              {update.time_off_site ? ` - ${update.time_off_site}` : ''}
                            </span>
                          </div>
                          {update.notes && (
                            <p className="text-sm text-slate-700 mb-2 whitespace-pre-wrap">{update.notes}</p>
                          )}
                          {update.materials_used && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <span className="text-xs font-semibold text-slate-500 uppercase">Materials:</span>
                              <p className="text-sm text-slate-600 mt-1">{update.materials_used}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
      
      {showInvoiceCreator && job && (
        <InvoiceCreator 
          job={job} 
          onClose={() => setShowInvoiceCreator(false)} 
          onCreated={() => {
            setShowInvoiceCreator(false);
            fetchJobData();
          }}
        />
      )}

      {viewingInvoiceId && (
        <InvoiceView 
          invoiceId={viewingInvoiceId} 
          onClose={() => setViewingInvoiceId(null)} 
          onEdit={async (invoice) => {
            setViewingInvoiceId(null);
            setEditingInvoice({ job, invoice });
          }}
        />
      )}

      {editingInvoice && (
        <InvoiceCreator 
          job={editingInvoice.job} 
          invoice={editingInvoice.invoice}
          onClose={() => setEditingInvoice(null)} 
          onCreated={() => {
            setEditingInvoice(null);
            fetchJobData();
          }}
        />
      )}

      {viewingWorkOrderId && (
        <WorkOrderView 
          jobId={viewingWorkOrderId} 
          onClose={() => setViewingWorkOrderId(null)} 
        />
      )}

      {viewingPhoto && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4 md:p-8">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col md:flex-row overflow-hidden relative">
            <button 
              onClick={() => setViewingPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white hover:bg-black/70 rounded-full transition z-10"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex-1 bg-black flex items-center justify-center p-4">
              <img 
                src={viewingPhoto.local_path || (viewingPhoto.drive_file_id ? `https://drive.google.com/uc?export=view&id=${viewingPhoto.drive_file_id}` : viewingPhoto.drive_url)} 
                alt="Job Photo" 
                className="max-w-full max-h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <PhotoComments photoId={viewingPhoto.id} user={user} />
          </div>
        </div>
      )}
    </div>
  );
}
