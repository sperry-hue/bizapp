import React, { useState, useEffect } from 'react';
import { Job, Task, JobUpdate, Photo } from '../types';
import { X, Printer, Download, MapPin, Phone, Mail, Calendar, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';
import { apiFetch } from '../services/api';

interface WorkOrderViewProps {
  jobId: number;
  onClose: () => void;
}

export default function WorkOrderView({ jobId, onClose }: WorkOrderViewProps) {
  const [data, setData] = useState<(Job & { tasks: Task[], updates: JobUpdate[], photos: Photo[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkOrder();
  }, [jobId]);

  const fetchWorkOrder = async () => {
    try {
      const res = await apiFetch(`/api/jobs/${jobId}/work-order`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error('Failed to fetch work order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-xl shadow-xl">
          <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Loading Work Order...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white shadow-2xl w-full max-w-4xl min-h-[95vh] my-8 p-12 font-sans text-slate-900 relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 no-print"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-brand rounded-lg flex items-center justify-center shadow-lg transform rotate-45">
              <div className="transform -rotate-45 text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                  <path d="M12 15.5l-4 1.75 4-9.75 4 9.75z" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-2xl tracking-tight">
                <span className="font-black text-brand">CENTRAL</span>
                <span className="font-light text-slate-800 ml-1">Electrical</span>
              </h1>
              <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mt-1">Professional Electrical Services</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-5xl font-black text-slate-100 mb-4">WORK ORDER</h2>
            <div className="text-sm text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">Central Electrical</p>
              <p>25 Goose Creek Drive</p>
              <p>Fairview, PE C0A 1H2</p>
              <p>902-218-5648</p>
            </div>
          </div>
        </div>

        <div className="h-1 bg-brand w-full mb-8"></div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">CUSTOMER INFORMATION</h3>
            <div className="space-y-3">
              <p className="text-xl font-bold text-slate-900">{data.customer_name}</p>
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin className="w-4 h-4 mt-1 shrink-0 text-brand" />
                <span>{data.address}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Phone className="w-4 h-4 shrink-0 text-brand" />
                <span>{data.phone}</span>
              </div>
              {data.customer_email && (
                <div className="flex items-center gap-2 text-slate-600">
                  <Mail className="w-4 h-4 shrink-0 text-brand" />
                  <span>{data.customer_email}</span>
                </div>
              )}
            </div>
          </div>
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">ORDER DETAILS</h3>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div className="text-slate-500 font-medium">Order Number:</div>
              <div className="text-right font-bold text-slate-900">WO-{data.id.toString().padStart(4, '0')}</div>
              <div className="text-slate-500 font-medium">Date Created:</div>
              <div className="text-right font-bold text-slate-900">{new Date(data.created_at).toLocaleDateString()}</div>
              <div className="text-slate-500 font-medium">Status:</div>
              <div className="text-right font-bold text-brand uppercase tracking-wider">{data.status}</div>
              <div className="text-slate-500 font-medium">Priority:</div>
              <div className="text-right font-bold text-slate-900">{data.priority}</div>
            </div>
          </div>
        </div>

        {/* Scope of Work */}
        <div className="mb-12">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">SCOPE OF WORK</h3>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-widest border-b border-slate-200">
                  <th className="p-4 w-16">#</th>
                  <th className="p-4">Task Description</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.tasks.map((task, idx) => (
                  <tr key={task.id}>
                    <td className="p-4 text-slate-400 font-mono text-xs">{(idx + 1).toString().padStart(2, '0')}</td>
                    <td className="p-4 text-slate-800 font-medium">{task.description}</td>
                    <td className="p-4 text-right">
                      {task.completed ? 
                        <span className="text-emerald-600 flex items-center justify-end gap-1 font-bold text-xs">
                          <CheckCircle2 className="w-3 h-3" /> DONE
                        </span> : 
                        <span className="text-slate-400 font-bold text-xs">PENDING</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Work Performed / Updates */}
        {data.updates.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">WORK PERFORMED & MATERIALS</h3>
            <div className="space-y-6">
              {data.updates.map((update) => (
                <div key={update.id} className="border-l-4 border-brand pl-6 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">{new Date(update.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-800 mb-3">{update.notes}</p>
                  {update.materials_used && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Materials Used</p>
                      <p className="text-sm text-slate-700 italic">{update.materials_used}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {data.photos.length > 0 && (
          <div className="mb-12 no-print">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">SITE DOCUMENTATION</h3>
            <div className="grid grid-cols-3 gap-4">
              {data.photos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-xl overflow-hidden border border-slate-200">
                  <img 
                    src={photo.local_path || (photo.drive_file_id ? `https://drive.google.com/uc?export=view&id=${photo.drive_file_id}` : photo.drive_url)} 
                    alt="Site" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signatures */}
        <div className="mt-24 grid grid-cols-2 gap-24">
          <div className="border-t border-slate-300 pt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">TECHNICIAN SIGNATURE</p>
            <div className="h-12"></div>
            <p className="text-xs text-slate-500">Date: ____________________</p>
          </div>
          <div className="border-t border-slate-300 pt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">CUSTOMER SIGNATURE</p>
            <div className="h-12"></div>
            <p className="text-xs text-slate-500">Date: ____________________</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-24 pt-8 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-[0.3em] font-bold">Thank you for choosing Central Electrical</p>
        </div>

        {/* Actions */}
        <div className="mt-12 flex justify-center gap-4 no-print">
          <button 
            onClick={onClose}
            className="px-6 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
          <button 
            onClick={handlePrint}
            className="px-8 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 shadow-lg flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Work Order
          </button>
        </div>
      </div>
    </div>
  );
}
