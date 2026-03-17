import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Customer, Job, Invoice, User } from '../types';
import { 
  Contact, Phone, MapPin, Mail, Briefcase, Receipt, 
  ChevronLeft, Calendar, Clock, AlertCircle, CheckCircle2, Eye, Share2 
} from 'lucide-react';
import { apiFetch } from '../services/api';
import InvoiceView from './InvoiceView';

interface CustomerDetailProps {
  user: User;
}

export default function CustomerDetail({ user }: CustomerDetailProps) {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobSites, setJobSites] = useState<{id: number, name: string, address: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCustomerData();
      fetchJobSites();
    }
  }, [id]);

  const fetchCustomerData = async () => {
    try {
      const [customerRes, jobsRes, invoicesRes] = await Promise.all([
        apiFetch(`/api/customers/${id}`),
        apiFetch(`/api/customers/${id}/jobs`),
        apiFetch(`/api/customers/${id}/invoices`)
      ]);

      const [customerData, jobsData, invoicesData] = await Promise.all([
        customerRes.json(),
        jobsRes.json(),
        invoicesRes.json()
      ]);

      setCustomer(customerData);
      setJobs(jobsData);
      setInvoices(invoicesData);
    } catch (error) {
      console.error("Failed to fetch customer data", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobSites = async () => {
    try {
      const res = await apiFetch(`/api/customers/${id}/job-sites`);
      const data = await res.json();
      setJobSites(data);
    } catch (e) {
      console.error('Failed to fetch job sites:', e);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading customer profile...</div>;
  }

  if (!customer) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 text-brand mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">Customer Not Found</h3>
        <Link to="/admin" className="text-brand hover:text-brand-hover font-medium">Return to Dashboard</Link>
      </div>
    );
  }

  const openJobs = jobs.filter(job => job.status !== 'Completed');

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link 
            to="/admin" 
            className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
            <p className="text-sm text-slate-500">Customer Profile</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <a
            href={`/portal/${customer.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition text-sm"
          >
            <Eye className="w-4 h-4" />
            View Portal
          </a>
          <button 
            onClick={() => {
              const portalUrl = `${window.location.origin}/portal/${customer.id}`;
              navigator.clipboard.writeText(portalUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition text-sm ${
              copied ? 'bg-emerald-500 text-white' : 'bg-brand text-white hover:bg-brand-hover'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Share Portal
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer Info Card */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 sticky top-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center">
                <Contact className="w-6 h-6 text-brand" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Contact Details</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Address</p>
                  <p className="text-slate-800">{customer.address}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</p>
                  <p className="text-slate-800">{customer.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Email</p>
                  <p className="text-slate-800">{customer.email || 'No email provided'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Customer Since</p>
                  <p className="text-slate-800">{new Date(customer.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-6">
            <h3 className="font-semibold text-slate-900 mb-4">Job Sites</h3>
            <div className="space-y-2">
              {jobSites.map(js => (
                <div key={js.id} className="text-sm text-slate-600 p-2 bg-slate-50 rounded-lg">
                  <span className="font-semibold">{js.name}</span> - {js.address}
                </div>
              ))}
              {jobSites.length === 0 && <p className="text-sm text-slate-500 italic">No job sites defined.</p>}
            </div>
          </div>
        </div>

        {/* Jobs and Invoices */}
        <div className="lg:col-span-2 space-y-8">
          {/* Open Jobs Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-brand" />
                Open Jobs ({openJobs.length})
              </h2>
            </div>

            <div className="space-y-4">
              {openJobs.length > 0 ? (
                openJobs.map(job => (
                  <Link 
                    key={job.id} 
                    to={`/job/${job.id}`}
                    className="block bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-brand/20 transition group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            job.priority === 'Urgent' ? 'bg-brand-light text-brand' :
                            job.priority === 'High' ? 'bg-orange-100 text-orange-700' :
                            job.priority === 'Medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {job.priority}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            job.status === 'New' ? 'bg-indigo-100 text-indigo-700' :
                            job.status === 'In Progress' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {job.status}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-brand transition">Job #{job.id}</h3>
                        <p className="text-sm text-slate-500 line-clamp-1">{job.notes || 'No notes provided'}</p>
                      </div>
                      <div className="text-right text-xs text-slate-400">
                        <div className="flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3" />
                          {new Date(job.created_at).toLocaleDateString()}
                        </div>
                        {job.scheduled_date && (
                          <div className="flex items-center gap-1 justify-end mt-1 text-brand font-medium">
                            <Clock className="w-3 h-3" />
                            Scheduled: {new Date(job.scheduled_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 p-8 rounded-xl text-center">
                  <p className="text-slate-500">No open jobs for this customer.</p>
                </div>
              )}
            </div>
          </section>

          {/* Invoices Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-brand" />
                Invoices ({invoices.length})
              </h2>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 font-semibold text-slate-700 text-sm">Invoice #</th>
                    <th className="p-4 font-semibold text-slate-700 text-sm">Date</th>
                    <th className="p-4 font-semibold text-slate-700 text-sm">Amount</th>
                    <th className="p-4 font-semibold text-slate-700 text-sm">Status</th>
                    <th className="p-4 font-semibold text-slate-700 text-sm text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.length > 0 ? (
                    invoices.map(invoice => (
                      <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="p-4 text-sm font-medium text-slate-900">INV-{invoice.id.toString().padStart(4, '0')}</td>
                        <td className="p-4 text-sm text-slate-600">{new Date(invoice.created_at).toLocaleDateString()}</td>
                        <td className="p-4 text-sm font-semibold text-slate-900">${invoice.amount.toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' :
                            invoice.status === 'Sent' ? 'bg-blue-100 text-blue-700' :
                            invoice.status === 'Overdue' ? 'bg-brand-light text-brand' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {invoice.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => setViewingInvoiceId(invoice.id)}
                            className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition"
                            title="View Invoice"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 text-sm">No invoices found for this customer.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {viewingInvoiceId && (
        <InvoiceView 
          invoiceId={viewingInvoiceId} 
          onClose={() => setViewingInvoiceId(null)} 
        />
      )}
    </div>
  );
}
