import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Invoice, InvoiceItem, Estimate, EstimateItem, Settings } from '../types';
import { Printer, Download, Loader2, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PublicDocumentViewProps {
  type: 'invoice' | 'estimate';
}

export default function PublicDocumentView({ type }: PublicDocumentViewProps) {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, type]);

  const fetchData = async () => {
    try {
      const [dataRes, settingsRes] = await Promise.all([
        fetch(`/api/public/${type}/${token}`),
        fetch('/api/settings')
      ]);

      if (dataRes.ok) {
        setData(await dataRes.json());
      }
      if (settingsRes.ok) {
        setSettings(await settingsRes.json());
      }
    } catch (error) {
      console.error(`Failed to fetch ${type} data:`, error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generatePDF = async () => {
    if (!documentRef.current || !data) return null;
    
    const noPrintElements = documentRef.current.querySelectorAll('.no-print');
    noPrintElements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    
    try {
      const canvas = await html2canvas(documentRef.current, {
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
    if (!data) return;
    
    try {
      setProcessing(true);
      const pdf = await generatePDF();
      if (pdf) {
        const filename = type === 'invoice' 
          ? `Invoice_${data.id.toString().padStart(4, '0')}_${data.customer_name}.pdf`
          : `Estimate_${data.id.toString().padStart(4, '0')}_${data.customer_name}.pdf`;
        pdf.save(filename);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading {type}...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-brand mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{type.charAt(0).toUpperCase() + type.slice(1)} Not Found</h1>
          <p className="text-slate-600 mb-6">We couldn't find the {type} you're looking for. Please check the link or contact us.</p>
          <p className="text-sm text-slate-400">{settings?.company_name || 'Central Electrical'}</p>
        </div>
      </div>
    );
  }

  const subtotal = data.items.reduce((sum: number, item: any) => sum + item.amount, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  const handleAccept = async () => {
    if (type !== 'estimate' || !data) return;
    
    try {
      setProcessing(true);
      const res = await fetch(`/api/public/estimate/${token}/accept`, {
        method: 'POST'
      });
      
      if (res.ok) {
        const result = await res.json();
        alert('Estimate accepted! Thank you.');
        setData({ ...data, status: 'Accepted' });
      } else {
        const err = await res.json();
        alert(`Failed to accept estimate: ${err.message}`);
      }
    } catch (error) {
      console.error('Error accepting estimate:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto bg-white shadow-2xl rounded-2xl overflow-hidden relative print:shadow-none print:rounded-none">
        
        {processing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
              <p className="text-slate-900 font-bold">Processing PDF...</p>
            </div>
          </div>
        )}

        <div ref={documentRef} className="p-8 md:p-12 font-sans text-slate-900 bg-white">
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
              <h2 className="text-5xl font-black text-slate-900 mb-4 uppercase">{type}</h2>
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
            <div className="flex-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Bill To:</h3>
              <div className="text-slate-800">
                <p className="font-bold text-lg">{data.customer_name}</p>
                <p className="text-slate-600">{data.job_address || data.customer_address}</p>
                <p className="text-slate-600">{data.customer_phone}</p>
              </div>
            </div>
            <div className="w-full md:w-64">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-slate-900 font-medium">{type.charAt(0).toUpperCase() + type.slice(1)} Number:</div>
                <div className="text-right font-bold">{type === 'invoice' ? 'INV' : 'EST'}-{data.id.toString().padStart(4, '0')}</div>
                <div className="text-slate-900 font-medium">Date:</div>
                <div className="text-right font-bold">{new Date(data.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div className="text-slate-900 font-medium">Status:</div>
                <div className="text-right font-bold uppercase text-xs">
                  <span className={`px-2 py-0.5 rounded ${
                    data.status === 'Paid' || data.status === 'Accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {data.status}
                  </span>
                </div>
                <div className="col-span-2 mt-2 p-3 bg-slate-100 rounded-lg flex justify-between items-center">
                  <span className="font-black text-slate-900 text-xs uppercase">Total (CAD):</span>
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
                {data.items.map((item: any, idx: number) => (
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

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center flex-wrap gap-4 no-print">
          {type === 'estimate' && (data.status === 'Draft' || data.status === 'Sent') && (
            <button 
              onClick={handleAccept}
              disabled={processing}
              className="px-8 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-70"
            >
              <Loader2 className={`w-4 h-4 ${processing ? 'animate-spin' : 'hidden'}`} />
              Accept Estimate
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
