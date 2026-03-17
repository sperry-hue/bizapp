import React, { useState, useEffect, useRef } from 'react';
import { Invoice, InvoiceItem, Settings } from '../types';
import { X, Printer, Download, Loader2, Receipt, Edit, HardDrive, Mail } from 'lucide-react';
import { apiFetch } from '../services/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvoiceViewProps {
  invoiceId: number;
  onClose: () => void;
  onEdit?: (invoice: InvoiceWithItems) => void;
  isPublic?: boolean;
}

interface InvoiceWithItems extends Invoice {
  items: InvoiceItem[];
  customer_phone?: string;
  customer_email?: string;
  job_notes?: string;
}

export default function InvoiceView({ invoiceId, onClose, onEdit, isPublic }: InvoiceViewProps) {
  const [invoice, setInvoice] = useState<InvoiceWithItems | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [invoiceId]);

  const fetchData = async () => {
    try {
      const [invoiceRes, settingsRes] = await Promise.all([
        apiFetch(`/api/invoices/${invoiceId}`),
        apiFetch('/api/settings')
      ]);
      const [invoiceData, settingsData] = await Promise.all([
        invoiceRes.json(),
        settingsRes.json()
      ]);
      setInvoice(invoiceData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to fetch invoice data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generatePDF = async () => {
    if (!invoiceRef.current || !invoice) return null;
    
    // Temporarily hide no-print elements
    const noPrintElements = invoiceRef.current.querySelectorAll('.no-print');
    noPrintElements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    
    try {
      // Generate canvas from the invoice element
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      // Restore no-print elements
      noPrintElements.forEach(el => {
        (el as HTMLElement).style.display = '';
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      if (!imgData || imgData === 'data:,') {
        throw new Error('Generated image data is empty or invalid');
      }

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
      // Restore no-print elements in case of error
      noPrintElements.forEach(el => {
        (el as HTMLElement).style.display = '';
      });
      throw error;
    }
  };

  const handleDownloadPDF = async () => {
    if (!invoice) return;
    
    try {
      setProcessing(true);
      const pdf = await generatePDF();
      if (pdf) {
        pdf.save(`Invoice_${invoice.id.toString().padStart(4, '0')}_${invoice.customer_name}.pdf`);
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleEmail = async () => {
    if (!invoice) return;
    
    // Open a blank window immediately to avoid popup blockers
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
            <p>Preparing your invoice and email link...</p>
          </body>
        </html>
      `);
    }

    setProcessing(true);
    try {
      let driveUrl = invoice.drive_url;

      // If no drive URL, save to drive first
      if (!driveUrl) {
        try {
          // We pass silent=true because we're already showing processing state
          const savedUrl = await handleSaveToDrive(true);
          if (savedUrl) {
            driveUrl = savedUrl;
          }
        } catch (error) {
          console.error('Failed to save to drive before emailing:', error);
        }
      }
      
      const to = invoice.customer_email || '';
      const cc = 'margaret.clarkin@bellaliant.net';
      const subject = encodeURIComponent(`Invoice #${invoice.id.toString().padStart(4, '0')} from ${settings?.company_name || 'Central Electrical'}`);
      
      let bodyText = `Hello ${invoice.customer_name},\n\nPlease find your invoice attached.`;
      
      // Use public URL for non-Google users
      if (invoice.public_token) {
        const publicUrl = `${window.location.origin}/invoice/${invoice.public_token}`;
        bodyText += `\n\nYou can also view it online here: ${publicUrl}`;
      } else if (driveUrl) {
        bodyText += `\n\nYou can also view it online here: ${driveUrl}`;
      }
      
      bodyText += `\n\nThank you for your business!\n\n${settings?.company_name || 'Central Electrical'}`;
      
      const body = encodeURIComponent(bodyText);
      
      // Open Gmail compose window
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&cc=${cc}&su=${subject}&body=${body}`;
      
      if (emailWindow) {
        emailWindow.location.href = gmailUrl;
      } else {
        // Fallback if window.open failed initially
        window.open(gmailUrl, '_blank');
      }

      // We also trigger a download as a backup
      const pdf = await generatePDF();
      if (pdf) {
        pdf.save(`Invoice_${invoice.id.toString().padStart(4, '0')}_${invoice.customer_name}.pdf`);
      }
    } catch (error) {
      console.error('Error in handleEmail:', error);
      if (emailWindow) emailWindow.close();
      alert('Failed to prepare email. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveToDrive = async (silent = false) => {
    if (!invoice) return null;
    
    try {
      if (!silent) setProcessing(true);
      
      const pdf = await generatePDF();
      if (!pdf) throw new Error('Failed to generate PDF');

      const pdfBase64 = pdf.output('datauristring');

      const res = await apiFetch(`/api/invoices/${invoiceId}/save-to-drive`, {
        method: 'POST',
        body: JSON.stringify({ pdfBase64 })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save to Google Drive');
      }
      
      if (data.url) {
        setInvoice({ ...invoice, drive_url: data.url });
        
        if (!silent) {
          alert('Successfully saved to Google Drive!');
          window.open(data.url, '_blank');
        }
      } else if (!silent) {
        alert('Successfully saved to Google Drive!');
      }
      
      return data.url as string;
    } catch (error: any) {
      console.error('Save to Drive Error:', error);
      if (!silent) {
        alert(`Failed to save to Google Drive: ${error.message}`);
      }
      throw error;
    } finally {
      if (!silent) setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
          <p className="text-slate-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center">
          <p className="text-brand font-bold mb-4">Invoice not found</p>
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg">Close</button>
        </div>
      </div>
    );
  }

  const subtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white shadow-2xl w-full max-w-4xl min-h-[95vh] my-8 relative">
        
        {/* Processing Overlay */}
        {processing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[60]">
            <div className="flex flex-col items-center">
              <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
              <p className="text-slate-900 font-bold">Processing PDF...</p>
              <p className="text-slate-500 text-sm">This may take a few seconds</p>
            </div>
          </div>
        )}

        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 no-print z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div ref={invoiceRef} className="p-6 md:p-12 font-sans text-slate-900 bg-white">
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
            <h2 className="text-5xl font-black text-slate-900 mb-4">INVOICE</h2>
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
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">BILL TO</h3>
            <div className="text-slate-800">
              <p className="font-bold text-lg">{invoice.customer_name}</p>
              <p className="text-slate-600">{invoice.job_address}</p>
              <p className="text-slate-600">{invoice.customer_phone}</p>
            </div>
          </div>
          <div className="w-full md:w-64">
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-slate-900 font-medium">Invoice Number:</div>
              <div className="text-right font-bold">INV-{invoice.id.toString().padStart(4, '0')}</div>
              <div className="text-slate-900 font-medium">Invoice Date:</div>
              <div className="text-right font-bold">{new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div className="text-slate-900 font-medium">Status:</div>
              <div className="text-right font-bold uppercase text-xs">
                <span className={`px-2 py-0.5 rounded ${
                  invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {invoice.status}
                </span>
              </div>
              <div className="col-span-2 mt-2 p-3 bg-slate-100 rounded-lg flex justify-between items-center">
                <span className="font-black text-slate-900 text-xs uppercase">Amount Due (CAD):</span>
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
              {invoice.items.map((item, idx) => (
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
            <div className="flex justify-between text-xl p-3 bg-slate-900 text-white rounded-lg">
              <span className="font-light uppercase text-xs self-center">Amount Due (CAD):</span>
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
        
        <div className="mt-12 flex justify-center gap-4 no-print flex-wrap p-6 bg-white border-t border-slate-100">
          <button 
            onClick={onClose}
            className="px-6 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50"
          >
            Close
          </button>
          {onEdit && !isPublic && (
            <button 
              onClick={() => onEdit(invoice)}
              className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Invoice
            </button>
          )}
          {!isPublic && (
            <button 
              onClick={handleSaveToDrive}
              disabled={processing}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-70"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              {processing ? 'Processing...' : 'Save to Google Drive'}
            </button>
          )}
          {!isPublic && (
            <button 
              onClick={handleEmail}
              disabled={processing}
              className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-70"
            >
              <Mail className="w-4 h-4" />
              Email Invoice
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
            className="px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 shadow-lg shadow-slate-800/10 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
