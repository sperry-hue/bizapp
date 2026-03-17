import React, { useState, useEffect, useRef } from 'react';
import { Estimate, EstimateItem, Settings } from '../types';
import { X, Printer, Download, Loader2, FileText, Edit, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { apiFetch } from '../services/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface EstimateViewProps {
  estimateId: number;
  onClose: () => void;
  onEdit?: (estimate: EstimateWithItems) => void;
  onAccept?: (estimateId: number, token?: string) => void;
  onDecline?: (estimateId: number, token?: string) => void;
  isPublic?: boolean;
}

interface EstimateWithItems extends Estimate {
  items: EstimateItem[];
  customer_phone?: string;
  customer_address?: string;
  customer_email?: string;
}

export default function EstimateView({ estimateId, onClose, onEdit, onAccept, onDecline, isPublic }: EstimateViewProps) {
  const [estimate, setEstimate] = useState<EstimateWithItems | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const estimateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [estimateId]);

  const fetchData = async () => {
    try {
      const [estimateRes, settingsRes] = await Promise.all([
        apiFetch(`/api/estimates/${estimateId}`),
        apiFetch('/api/settings')
      ]);
      const [estimateData, settingsData] = await Promise.all([
        estimateRes.json(),
        settingsRes.json()
      ]);
      setEstimate(estimateData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch estimate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generatePDF = async () => {
    if (!estimateRef.current || !estimate) return null;
    
    const noPrintElements = estimateRef.current.querySelectorAll('.no-print');
    noPrintElements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    
    try {
      const canvas = await html2canvas(estimateRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      noPrintElements.forEach(el => {
        (el as HTMLElement).style.display = '';
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let heightLeft = pdfHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      
      return pdf;
    } catch (error) {
      noPrintElements.forEach(el => {
        (el as HTMLElement).style.display = '';
      });
      throw error;
    }
  };

  const handleDownloadPDF = async () => {
    if (!estimate) return;
    
    try {
      setProcessing(true);
      const pdf = await generatePDF();
      if (pdf) {
        pdf.save(`Estimate_${estimate.id.toString().padStart(4, '0')}_${estimate.customer_name}.pdf`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleEmail = async () => {
    if (!estimate) return;
    
    const emailWindow = window.open('', '_blank');
    if (emailWindow) {
      emailWindow.document.write(`
        <html>
          <head>
            <title>Preparing Email...</title>
            <style>
              body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
              .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top: 4px solid #0ea5e9; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="spinner"></div>
            <p>Preparing your estimate and email link...</p>
          </body>
        </html>
      `);
    }

    setProcessing(true);
    try {
      const to = estimate.customer_email || '';
      const cc = 'margaret.clarkin@bellaliant.net';
      const subject = encodeURIComponent(`Estimate #${estimate.id.toString().padStart(4, '0')} from ${settings?.company_name || 'Central Electrical'}`);
      
      let bodyText = `Hello ${estimate.customer_name},\n\nPlease find your estimate attached.`;
      
      if (estimate.public_token) {
        const publicUrl = `${window.location.origin}/estimate/${estimate.public_token}`;
        bodyText += `\n\nYou can also view and accept it online here: ${publicUrl}`;
      }
      
      bodyText += `\n\nThank you for the opportunity!\n\n${settings?.company_name || 'Central Electrical'}`;
      
      const body = encodeURIComponent(bodyText);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&cc=${cc}&su=${subject}&body=${body}`;
      
      if (emailWindow) {
        emailWindow.location.href = gmailUrl;
      } else {
        window.open(gmailUrl, '_blank');
      }

      const pdf = await generatePDF();
      if (pdf) {
        pdf.save(`Estimate_${estimate.id.toString().padStart(4, '0')}_${estimate.customer_name}.pdf`);
      }
    } catch (error) {
      console.error('Error in handleEmail:', error);
      if (emailWindow) emailWindow.close();
      alert('Failed to prepare email. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
          <p className="text-slate-600">Loading estimate...</p>
        </div>
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center">
          <p className="text-brand font-bold mb-4">Estimate not found</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const subtotal = estimate.items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white shadow-2xl w-full max-w-4xl min-h-[95vh] my-8 p-6 md:p-12 font-sans text-slate-900 relative">
        {processing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
              <p className="text-slate-900 font-bold">Processing PDF...</p>
            </div>
          </div>
        )}
        
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 no-print"
        >
          <X className="w-6 h-6" />
        </button>

        <div ref={estimateRef}>
          {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt="Logo" 
                className="w-80 h-40 object-contain object-left" 
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-40 h-40 bg-brand rounded-lg flex items-center justify-center shadow-lg transform rotate-45">
                <div className="transform -rotate-45 text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-24 h-24">
                    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                    <path d="M12 15.5l-4 1.75 4-9.75 4 9.75z" />
                  </svg>
                </div>
              </div>
            )}
          </div>
          <div className="text-left md:text-right">
            <h2 className="text-5xl font-black text-slate-900 mb-4 uppercase">Estimate</h2>
            <div className="text-sm text-slate-600 space-y-1">
              {settings?.address?.split('\n').map((line, i) => <p key={i}>{line}</p>)}
              <p>{settings?.phone}</p>
              <p>{settings?.email}</p>
              {settings?.hst_number && <p className="text-xs mt-1">HST: {settings.hst_number}</p>}
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-200 w-full mb-8"></div>

        {/* Middle Section */}
        <div className="flex flex-col md:flex-row justify-between mb-12 gap-8">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">ESTIMATE FOR</h3>
            <div className="text-slate-800">
              <p className="font-bold text-lg">{estimate.customer_name}</p>
              <p className="text-slate-600">{estimate.customer_address || estimate.job_address}</p>
              <p className="text-slate-600">{estimate.customer_phone}</p>
            </div>
          </div>
          <div className="w-full md:w-64">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-slate-900 font-medium">Estimate Number:</div>
              <div className="text-right font-bold">EST-{estimate.id.toString().padStart(4, '0')}</div>
              <div className="text-slate-900 font-medium">Estimate Date:</div>
              <div className="text-right font-bold">{new Date(estimate.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div className="text-slate-900 font-medium">Valid Until:</div>
              <div className="text-right font-bold">{new Date(new Date(estimate.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div className="text-slate-900 font-medium">Status:</div>
              <div className="text-right font-bold uppercase text-xs">
                <span className={`px-2 py-0.5 rounded ${
                  estimate.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 
                  estimate.status === 'Declined' ? 'bg-brand-light text-brand' : 'bg-amber-100 text-amber-700'
                }`}>
                  {estimate.status}
                </span>
              </div>
              <div className="col-span-2 mt-2 p-3 bg-slate-100 rounded-lg flex justify-between items-center">
                <span className="font-black text-slate-900 text-xs uppercase">Total Estimate (CAD):</span>
                <span className="font-black text-xl">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto mb-12">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-100 text-left text-xs font-black text-slate-900 uppercase tracking-widest">
                <th className="p-4 rounded-l-lg">Items</th>
                <th className="p-4 text-center">Quantity</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4 text-right rounded-r-lg">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {estimate.items.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-4 font-medium text-slate-800">{item.description}</td>
                  <td className="p-4 text-center text-slate-600">{item.quantity}</td>
                  <td className="p-4 text-right text-slate-600">${item.unit_price.toFixed(2)}</td>
                  <td className="p-4 text-right font-bold text-slate-800">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-12">
          <div className="w-full md:w-64 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-900 font-medium">Subtotal:</span>
              <span className="font-bold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-900 font-medium">HST 15%:</span>
              <span className="font-bold">${tax.toFixed(2)}</span>
            </div>
            <div className="h-px bg-slate-200 w-full"></div>
            <div className="flex justify-between text-lg">
              <span className="text-slate-900 font-black">Total:</span>
              <span className="font-black">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-24 pt-8 border-t border-slate-100">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-2">Notes / Terms</h4>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{settings?.payment_info}</p>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap justify-center gap-4 no-print">
          <button 
            onClick={onClose}
            className="px-6 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
          
          {estimate.status === 'Draft' || estimate.status === 'Sent' ? (
            <>
              {onEdit && !isPublic && (
                <button 
                  onClick={() => onEdit(estimate)}
                  className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              {onDecline && (
                <button 
                  onClick={() => onDecline(estimate.id, estimate.public_token)}
                  className="px-6 py-2 bg-brand-light text-brand font-bold rounded-lg hover:bg-brand/10 flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Decline
                </button>
              )}
              {onAccept && (
                <button 
                  onClick={() => onAccept(estimate.id, estimate.public_token)}
                  className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-100 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isPublic ? 'Accept Estimate' : 'Accept & Invoice'}
                </button>
              )}
            </>
          ) : null}
          
          {!isPublic && (
            <button 
              onClick={handleEmail}
              disabled={processing}
              className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-70"
            >
              <Mail className="w-4 h-4" />
              Email Estimate
            </button>
          )}

          <button 
            onClick={handleDownloadPDF}
            disabled={processing}
            className="px-6 py-2 bg-brand text-white font-bold rounded-lg hover:bg-brand-hover shadow-lg shadow-brand/10 flex items-center gap-2 disabled:opacity-70"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>

          <button 
            onClick={handlePrint}
            disabled={processing}
            className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow-lg shadow-slate-800/10 flex items-center gap-2 disabled:opacity-70"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
