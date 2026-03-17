import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Customer, Job, Invoice, Settings, Estimate } from '../types';
import { 
  Phone, MapPin, Mail, Briefcase, Receipt, 
  Calendar, Clock, AlertCircle, Eye, Lightbulb, FileText 
} from 'lucide-react';
import { apiFetch } from '../services/api';
import InvoiceView from './InvoiceView';
import EstimateView from './EstimateView';

export default function CustomerPortal() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [viewingEstimateId, setViewingEstimateId] = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      fetchPortalData();
    }
  }, [id]);

  const fetchPortalData = async () => {
    try {
      const [customerRes, jobsRes, invoicesRes, estimatesRes, settingsRes] = await Promise.all([
        apiFetch(`/api/customers/${id}`),
        apiFetch(`/api/customers/${id}/jobs`),
        apiFetch(`/api/customers/${id}/invoices`),
        apiFetch(`/api/customers/${id}/estimates`),
        apiFetch('/api/settings')
      ]);

      if (customerRes.ok) setCustomer(await customerRes.json());
      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (invoicesRes.ok) setInvoices(await invoicesRes.json());
      if (estimatesRes.ok) setEstimates(await estimatesRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
    } catch (error) {
      console.error("Failed to fetch portal data", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-brand mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Portal Not Found</h1>
          <p className="text-slate-600 mb-6">We couldn't find the customer portal you're looking for. Please check the link or contact us.</p>
          <p className="text-sm text-slate-400">{settings?.company_name || 'Central Electrical'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {settings?.app_icon_url ? (
              <img src={settings.app_icon_url} alt="Logo" className="h-8 w-auto" referrerPolicy="no-referrer" />
            ) : settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-8 w-auto" referrerPolicy="no-referrer" />
            ) : (
              <Lightbulb className="w-8 h-8 text-brand" />
            )}
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-none">
                {settings?.company_name?.split(' ')[0] || 'CENTRAL'}
              </h1>
              <p className="text-[10px] font-bold text-brand tracking-widest uppercase">
                {settings?.company_name?.split(' ').slice(1).join(' ') || 'Electrical Solutions'}
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer Portal</p>
            <p className="text-sm font-bold text-slate-800">{customer.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="bg-gradient-to-br from-brand to-brand-hover rounded-3xl p-8 text-white shadow-xl shadow-brand/10 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2">Welcome, {customer.name.split(' ')[0]}</h2>
            <p className="text-brand-light max-w-md">View your job history, check scheduled appointments, and manage your invoices all in one place.</p>
          </div>
          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Jobs Section */}
            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-brand" />
                Your Jobs
              </h3>
              <div className="space-y-4">
                {jobs.length > 0 ? (
                  jobs.map(job => (
                    <div key={job.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            job.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {job.status}
                          </span>
                          <h4 className="text-lg font-bold text-slate-900 mt-1">Job #{job.id}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">{new Date(job.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          {job.address}
                        </div>
                        {job.scheduled_date && (
                          <div className="flex items-center gap-2 text-brand font-bold">
                            <Calendar className="w-4 h-4" />
                            Scheduled: {new Date(job.scheduled_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center">
                    <p className="text-slate-500">No jobs found in your history.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Invoices Section */}
            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand" />
                Your Invoices
              </h3>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Invoice</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.length > 0 ? (
                        invoices.map(invoice => (
                          <tr key={invoice.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 text-sm font-bold text-slate-900">INV-{invoice.id.toString().padStart(4, '0')}</td>
                            <td className="p-4 text-sm text-slate-600">{new Date(invoice.created_at).toLocaleDateString()}</td>
                            <td className="p-4 text-sm font-bold text-slate-900">${invoice.amount.toFixed(2)}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {invoice.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => setViewingInvoiceId(invoice.id)}
                                className="p-2 bg-brand-light text-brand rounded-lg hover:bg-brand/10 transition"
                                title="View & Download"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 italic">No invoices found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Estimates Section */}
            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand" />
                Your Estimates
              </h3>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Estimate</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Date</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Amount</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {estimates.length > 0 ? (
                        estimates.map(estimate => (
                          <tr key={estimate.id} className="hover:bg-slate-50 transition">
                            <td className="p-4 text-sm font-bold text-slate-900">EST-{estimate.id.toString().padStart(4, '0')}</td>
                            <td className="p-4 text-sm text-slate-600">{new Date(estimate.created_at).toLocaleDateString()}</td>
                            <td className="p-4 text-sm font-bold text-slate-900">${estimate.amount.toFixed(2)}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                estimate.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 
                                estimate.status === 'Declined' ? 'bg-rose-100 text-rose-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {estimate.status}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button 
                                onClick={() => setViewingEstimateId(estimate.id)}
                                className="p-2 bg-brand-light text-brand rounded-lg hover:bg-brand/10 transition"
                                title="View & Accept"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 italic">No estimates found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">Contact Information</h3>
              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-slate-400 shrink-0" />
                  <p className="text-slate-600">{customer.address}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-slate-400 shrink-0" />
                  <p className="text-slate-600">{customer.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-slate-400 shrink-0" />
                  <p className="text-slate-600">{customer.email || 'No email on file'}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
              <h3 className="font-bold mb-2">Need Help?</h3>
              <p className="text-slate-400 text-sm mb-4">If you have any questions about your jobs or invoices, please contact us.</p>
              <a href="tel:9022185648" className="block w-full bg-brand text-center py-3 rounded-xl font-bold hover:bg-brand-hover transition">
                Call 902-218-5648
              </a>
            </div>
          </div>
        </div>
      </main>

      {viewingEstimateId && (
        <EstimateView 
          estimateId={viewingEstimateId} 
          onClose={() => setViewingEstimateId(null)} 
          isPublic={true}
          onAccept={async (id, token) => {
            if (!token) return;
            try {
              const res = await fetch(`/api/public/estimate/${token}/accept`, { method: 'POST' });
              if (res.ok) {
                fetchPortalData();
                setViewingEstimateId(null);
              }
            } catch (error) {
              console.error('Failed to accept estimate:', error);
            }
          }}
          onDecline={async (id, token) => {
            if (!token) return;
            try {
              const res = await fetch(`/api/public/estimate/${token}/decline`, { method: 'POST' });
              if (res.ok) {
                fetchPortalData();
                setViewingEstimateId(null);
              }
            } catch (error) {
              console.error('Failed to decline estimate:', error);
            }
          }}
        />
      )}

      {viewingInvoiceId && (
        <InvoiceView 
          invoiceId={viewingInvoiceId} 
          onClose={() => setViewingInvoiceId(null)} 
          isPublic={true}
        />
      )}
    </div>
  );
}
