import React, { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { Job, JobUpdate } from '../types';
import { apiFetch } from '../services/api';

interface SubmitShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift?: JobUpdate; // Optional shift for editing
}

export default function SubmitShiftModal({ isOpen, onClose, onSuccess, shift }: SubmitShiftModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  
  // Form state
  const [shiftDate, setShiftDate] = useState('');
  const [timeOn, setTimeOn] = useState('08:00');
  const [timeOff, setTimeOff] = useState('16:30');
  const [notes, setNotes] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [location, setLocation] = useState('');
  const [addToCalendar, setAddToCalendar] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchJobs();
      if (shift) {
        setShiftDate(shift.date);
        setTimeOn(shift.time_on_site);
        setTimeOff(shift.time_off_site || '');
        setNotes(shift.notes);
        setSelectedJobId(shift.job_id.toString());
        setLocation(shift.location || '');
      } else {
        setShiftDate(new Date().toISOString().split('T')[0]);
        setTimeOn('08:00');
        setTimeOff('16:30');
        setNotes('');
        setSelectedJobId('');
        setLocation('');
        setAddToCalendar(false);
      }
    }
  }, [isOpen, shift]);

  const fetchJobs = async () => {
    try {
      const res = await apiFetch('/api/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (e) {
      console.error('Failed to fetch jobs:', e);
    }
  };

  const handleSubmitShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const method = shift ? 'PUT' : 'POST';
      const url = shift ? `/api/shifts/${shift.id}` : '/api/shifts';
      
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: shiftDate,
          time_on_site: timeOn,
          time_off_site: timeOff,
          notes,
          job_id: selectedJobId ? Number(selectedJobId) : undefined,
          location
        })
      });
      if (res.ok) {
        if (!shift) {
          setNotes('');
          setSelectedJobId('');
          setLocation('');
        }
        onSuccess();
        onClose();
        alert(shift ? 'Shift updated successfully!' : 'Shift submitted successfully!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to process shift');
      }
    } catch (e) {
      console.error('Error processing shift:', e);
      alert('An error occurred while processing shift');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!shift || !window.confirm('Are you sure you want to delete this shift?')) return;
    
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/shifts/${shift.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        onSuccess();
        onClose();
        alert('Shift deleted successfully!');
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete shift');
      }
    } catch (e) {
      console.error('Error deleting shift:', e);
      alert('An error occurred while deleting shift');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="text-xl font-bold text-slate-800">{shift ? 'Edit Shift' : 'Submit Shift'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmitShift} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Job / Customer (Optional)</label>
            <select
              value={selectedJobId}
              onChange={e => {
                const val = e.target.value;
                setSelectedJobId(val);
                // Auto-fill location if a job is selected
                if (val) {
                  const job = jobs.find(j => j.id === Number(val));
                  if (job) setLocation(job.address);
                }
              }}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none bg-white"
            >
              <option value="">General Shift / Shop Time</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>
                  {job.customer_name} - {job.address}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1 italic">Select a job for customer time tracking and calendar events.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Location / Site Address</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. 123 Main St or Store #456"
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1 italic">Specify the exact location for the office.</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={shiftDate}
              onChange={e => setShiftDate(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Time On</label>
              <input
                type="time"
                required
                value={timeOn}
                onChange={e => setTimeOn(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Time Off</label>
              <input
                type="time"
                required
                value={timeOff}
                onChange={e => setTimeOff(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What did you work on?"
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand focus:border-transparent outline-none h-24 resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="addToCalendar"
              checked={addToCalendar}
              onChange={e => setAddToCalendar(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <label htmlFor="addToCalendar" className="text-sm font-medium text-slate-700">Add to Google Calendar</label>
          </div>
          <div className="flex gap-3">
            {shift && (
              <button
                type="button"
                onClick={handleDeleteShift}
                disabled={submitting}
                className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className={`flex-[2] bg-brand text-white py-3 rounded-xl font-bold hover:bg-brand/90 transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2`}
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (shift ? 'Update Shift' : 'Submit Shift')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
