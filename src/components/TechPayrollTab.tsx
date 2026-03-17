import React, { useState, useEffect } from 'react';
import { Job, JobUpdate } from '../types';
import { apiFetch } from '../services/api';
import { Clock, Calendar as CalendarIcon, Loader2, Plus, X, Briefcase, MapPin, DollarSign, Edit2 } from 'lucide-react';
import SubmitShiftModal from './SubmitShiftModal';

export default function TechPayrollTab() {
  const [payrollData, setPayrollData] = useState<{
    total_hours: number;
    total_pay: number;
    hourly_rate: number;
    updates: JobUpdate[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<JobUpdate | null>(null);
  
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchMyPayroll = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/my-payroll?start_date=${startDate}&end_date=${endDate}`);
      const data = await res.json();
      setPayrollData(data);
    } catch (e) {
      console.error('Failed to fetch my payroll:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyPayroll();
  }, [startDate, endDate]);

  const formatHours = (hours: number) => hours.toFixed(2);
  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-brand" />
            My Payroll
          </h2>
          <p className="text-slate-500">Track your hours and earnings</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={fetchMyPayroll}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-brand hover:bg-brand/10 rounded-xl transition-all disabled:opacity-50"
            title="Refresh Payroll"
          >
            <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="text-sm border-none focus:ring-0 outline-none"
            />
            <span className="text-slate-300">to</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="text-sm border-none focus:ring-0 outline-none"
            />
          </div>
          <button
            onClick={() => setShowShiftModal(true)}
            className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl font-bold hover:bg-brand/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Submit Shift
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
        </div>
      ) : !payrollData ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No payroll data available.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 font-medium mb-1">Total Hours</p>
              <p className="text-3xl font-bold text-slate-800">{formatHours(payrollData.total_hours)}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-sm text-slate-500 font-medium mb-1">Hourly Rate</p>
              <p className="text-3xl font-bold text-slate-800">{formatCurrency(payrollData.hourly_rate)}</p>
            </div>
            <div className="bg-brand/5 p-6 rounded-2xl border border-brand/10 shadow-sm">
              <p className="text-sm text-brand font-medium mb-1">Estimated Pay</p>
              <p className="text-3xl font-bold text-brand">{formatCurrency(payrollData.total_pay)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Recent Time Entries</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {payrollData.updates.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No entries for this period.</div>
              ) : (
                payrollData.updates.map(update => {
                  const start = new Date(`${update.date}T${update.time_on_site}`);
                  const end = new Date(`${update.date}T${update.time_off_site}`);
                  let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                  if (diff < 0) diff += 24;

                  return (
                    <div key={update.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-800">
                            {new Date(update.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
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
                          <p className="text-xs text-slate-500">{formatCurrency(diff * payrollData.hourly_rate)}</p>
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
                })
              )}
            </div>
          </div>
        </>
      )}

      <SubmitShiftModal 
        isOpen={showShiftModal || !!editingShift} 
        onClose={() => {
          setShowShiftModal(false);
          setEditingShift(null);
        }} 
        onSuccess={fetchMyPayroll}
        shift={editingShift || undefined}
      />
    </div>
  );
}
