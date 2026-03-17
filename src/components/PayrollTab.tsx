import React, { useState, useEffect } from 'react';
import { PayrollEntry, JobUpdate } from '../types';
import { apiFetch } from '../services/api';
import { Clock, Calendar as CalendarIcon, Loader2, ChevronDown, ChevronUp, MapPin, DollarSign, Edit2 } from 'lucide-react';
import SubmitShiftModal from './SubmitShiftModal';

export default function PayrollTab() {
  const [payroll, setPayroll] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // Default to last 2 weeks
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedTech, setExpandedTech] = useState<number | null>(null);
  const [editingShift, setEditingShift] = useState<JobUpdate | null>(null);

  const fetchPayroll = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/payroll?start_date=${startDate}&end_date=${endDate}`);
      const data = await res.json();
      setPayroll(data);
    } catch (e) {
      console.error('Failed to fetch payroll:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [startDate, endDate]);

  const formatHours = (hours: number) => {
    return hours.toFixed(2);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-brand" />
          Payroll
        </h2>
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchPayroll}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-brand hover:bg-brand/10 rounded-xl transition-all disabled:opacity-50"
            title="Refresh Payroll"
          >
            <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="text-sm border-none focus:ring-0 outline-none"
              />
            </div>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="text-sm border-none focus:ring-0 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
        </div>
      ) : payroll.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No time entries found for this period.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {payroll.map(entry => (
            <div key={entry.tech_id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div 
                className="p-6 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedTech(expandedTech === entry.tech_id ? null : entry.tech_id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand/10 rounded-full flex items-center justify-center text-brand font-bold text-xl">
                    {entry.username[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{entry.username}</h3>
                    <p className="text-sm text-slate-500">Rate: {formatCurrency(entry.hourly_rate)}/hr</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-12">
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total Hours</p>
                    <p className="text-xl font-bold text-slate-800">{formatHours(entry.total_hours)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Total Pay</p>
                    <p className="text-xl font-bold text-brand">{formatCurrency(entry.total_pay)}</p>
                  </div>
                  {expandedTech === entry.tech_id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {expandedTech === entry.tech_id && (
                <div className="bg-slate-50 border-t border-slate-100 p-6">
                  <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Time Entries</h4>
                  <div className="space-y-3">
                    {entry.updates.map(update => {
                      const start = new Date(`${update.date}T${update.time_on_site}`);
                      const end = new Date(`${update.date}T${update.time_off_site}`);
                      let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                      if (diff < 0) diff += 24;

                      return (
                        <div key={update.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-slate-800">{new Date(update.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                              {update.customer_name && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                  update.customer_name === 'General Shift' 
                                    ? 'bg-slate-100 text-slate-600' 
                                    : 'bg-brand/10 text-brand'
                                }`}>
                                  {update.customer_name === 'General Shift' ? 'General Shift / Shop Time' : update.customer_name}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs text-slate-500">{update.time_on_site} - {update.time_off_site}</p>
                              {update.location && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-600 font-medium">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {update.location}
                                </div>
                              )}
                              {update.notes && update.notes !== 'Shift submitted via payroll tab' && (
                                <p className="text-[10px] text-slate-400 italic mt-0.5">"{update.notes}"</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div>
                              <p className="font-bold text-slate-800">{formatHours(diff)} hrs</p>
                              <p className="text-xs text-slate-500">{formatCurrency(diff * entry.hourly_rate)}</p>
                            </div>
                            <button
                              onClick={() => setEditingShift(update)}
                              className="p-2 text-slate-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-all"
                              title="Edit Shift"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <SubmitShiftModal 
        isOpen={!!editingShift} 
        onClose={() => setEditingShift(null)} 
        onSuccess={fetchPayroll}
        shift={editingShift || undefined}
      />
    </div>
  );
}
