import React, { useState, useEffect, useRef } from 'react';
import { Job, InvoiceItem, Invoice, Customer } from '../types';
import { PlusCircle, Trash2, Receipt, X, Sparkles, Loader2, Save, User, HardDrive } from 'lucide-react';
import { apiFetch } from '../services/api';
import { GoogleGenAI, Type } from "@google/genai";
import CustomerForm from './CustomerForm';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface InvoiceCreatorProps {
  job?: Job;
  invoice?: Invoice & { items: InvoiceItem[] };
  onClose: () => void;
  onCreated: () => void;
}

export default function InvoiceCreator({ job, invoice, onClose, onCreated }: InvoiceCreatorProps) {
  const [items, setItems] = useState<InvoiceItem[]>(invoice?.items || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savingToDrive, setSavingToDrive] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState(invoice?.status || 'Draft');
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(invoice?.customer_id || job?.customer_id || null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    fetchCustomers();
    if (!invoice && job) {
      analyzeJob();
    }
  }, [job?.id, invoice]);

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
      if (selectedCustomerId) {
        const c = data.find((cust: Customer) => cust.id === selectedCustomerId);
        if (c) setSelectedCustomer(c);
      }
    } catch (error) {
      console.error('Fetch customers error:', error);
    }
  };

  useEffect(() => {
    if (selectedCustomerId && customers.length > 0) {
      const c = customers.find(cust => cust.id === selectedCustomerId);
      if (c) setSelectedCustomer(c);
    }
  }, [selectedCustomerId, customers]);

  const analyzeJob = async () => {
    if (!job) return;
    setIsAnalyzing(true);
    try {
      const res = await apiFetch(`/api/jobs/${job.id}/data-for-invoice`);
      const { job: jobData, updates } = await res.json();
      
      const prompt = `
        Analyze the following electrical job data and suggest invoice line items.
        Job Description: ${jobData.notes}
        
        Technician Updates:
        ${updates.map((u: any) => `- Date: ${u.date}, Notes: ${u.notes}, Materials: ${u.materials_used}`).join('\n')}
        
        Return a JSON array of objects with:
        - description: string (clear, professional description of work or materials)
        - quantity: number
        - unit_price: number (estimate a fair market price if not clear, or 0 if unknown)
        - category: 'Labor' | 'Material' | 'Service'
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unit_price: { type: Type.NUMBER },
                category: { type: Type.STRING, enum: ['Labor', 'Material', 'Service'] }
              },
              required: ['description', 'quantity', 'unit_price', 'category']
            }
          }
        }
      });

      const data = JSON.parse(response.text || "[]");
      setItems(data.map((item: any) => ({
        ...item,
        amount: item.quantity * item.unit_price
      })));
    } catch (error) {
      console.error('Analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      const q = isNaN(item.quantity) ? 0 : (item.quantity || 0);
      const p = isNaN(item.unit_price) ? 0 : (item.unit_price || 0);
      item.amount = q * p;
    }
    newItems[index] = item;
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const tax = subtotal * 0.15;
  const total = subtotal + tax;

  const handleSave = async (andDrive = false) => {
    if (!selectedCustomerId) {
      alert('Please select a customer');
      return;
    }
    
    if (andDrive) {
      setSavingToDrive(true);
    } else {
      setIsSaving(true);
    }
    
    try {
      const url = invoice ? `/api/invoices/${invoice.id}` : '/api/invoices';
      const method = invoice ? 'PUT' : 'POST';
      
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          customer_id: selectedCustomerId,
          job_id: job?.id || null,
          amount: total,
          items,
          status
        })
      });
      if (res.ok) {
        const data = await res.json();
        const savedId = invoice ? invoice.id : data.id;
        
        if (andDrive && invoiceRef.current) {
          // Temporarily hide no-print elements
          const noPrintElements = invoiceRef.current.querySelectorAll('.no-print');
          noPrintElements.forEach(el => {
            (el as HTMLElement).style.display = 'none';
          });
          
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
          
          // Create PDF
          console.log('Generating PDF for Google Drive (Creator)...');
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          
          if (!imgData || imgData === 'data:,') {
            console.error('Canvas toDataURL failed or returned empty data');
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
          
          try {
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
          } catch (addImgError) {
            console.error('Error adding image to PDF (Creator):', addImgError);
            throw new Error('Failed to add image to PDF. The image data might be malformed.');
          }
          
          heightLeft -= pageHeight;
          
          while (heightLeft >= 0) {
            position = heightLeft - pdfHeight;
            pdf.addPage();
            try {
              pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
            } catch (addImgError) {
              console.error('Error adding image to PDF page (Creator):', addImgError);
            }
            heightLeft -= pageHeight;
          }
          
          // Get base64 string
          console.log('Converting PDF to data URI (Creator)...');
          const pdfBase64 = pdf.output('datauristring');

          console.log('Sending PDF to server for Google Drive upload (Creator)...');
          const driveRes = await apiFetch(`/api/invoices/${savedId}/save-to-drive`, {
            method: 'POST',
            body: JSON.stringify({ pdfBase64 })
          });
          
          const driveData = await driveRes.json();
          
          if (!driveRes.ok) {
            throw new Error(driveData.message || 'Failed to save to Google Drive');
          }
          
          alert('Successfully saved to Google Drive!');
          if (driveData.url) {
            window.open(driveData.url, '_blank');
          }
        }
        
        onCreated();
        onClose();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      alert(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
      setSavingToDrive(false);
    }
  };

  if (isPreview) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto relative">
          <div ref={invoiceRef} className="p-12 font-sans text-slate-900 bg-white">
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
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-5xl font-black text-slate-200 mb-4">INVOICE</h2>
              <div className="text-sm text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">Central Electrical</p>
                <p>25 Goose Creek Drive</p>
                <p>Fairview, Prince Edward Island C0A 1H2</p>
                <p>Canada</p>
                <p>902-218-5648</p>
                <p>info@centralelectrical.ca</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-200 w-full mb-8"></div>

          {/* Middle Section */}
          <div className="flex justify-between mb-12">
            <div>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">BILL TO</h3>
              <div className="text-slate-800">
                <p className="font-bold text-lg">{selectedCustomer?.name || job?.customer_name}</p>
                <p className="text-slate-600">{selectedCustomer?.address || job?.address}</p>
                <p className="text-slate-600">{selectedCustomer?.phone || job?.phone}</p>
              </div>
            </div>
            <div className="w-64">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-slate-500 font-medium">Invoice Number:</div>
                <div className="text-right font-bold">23xx (Auto)</div>
                <div className="text-slate-500 font-medium">P.O./S.O. Number:</div>
                <div className="text-right font-bold">-</div>
                <div className="text-slate-500 font-medium">Invoice Date:</div>
                <div className="text-right font-bold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div className="text-slate-500 font-medium">Payment Due:</div>
                <div className="text-right font-bold">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div className="col-span-2 mt-2 p-3 bg-slate-100 rounded-lg flex justify-between items-center">
                  <span className="font-black text-slate-500 text-xs uppercase">Amount Due (CAD):</span>
                  <span className="font-black text-xl">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full mb-12">
            <thead>
              <tr className="bg-slate-100 text-left text-xs font-black text-slate-500 uppercase tracking-widest">
                <th className="p-4 rounded-l-lg">Items</th>
                <th className="p-4 text-center">Quantity</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4 text-right rounded-r-lg">Amount</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-4 font-medium text-slate-800">{item.description}</td>
                  <td className="p-4 text-center text-slate-600">{item.quantity}</td>
                  <td className="p-4 text-right text-slate-600">${item.unit_price.toFixed(2)}</td>
                  <td className="p-4 text-right font-bold text-slate-800">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-12">
            <div className="w-64 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">Subtotal:</span>
                <span className="font-bold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 font-medium">HST 15%:</span>
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
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Notes / Terms</h4>
            <p className="text-sm text-slate-600">E-transfers can be sent to <span className="font-bold text-slate-800">pay@centralelectrical.ca</span></p>
          </div>
          </div>
          
          <div className="mt-12 flex justify-center gap-4 no-print flex-wrap p-6 bg-white border-t border-slate-100">
            <button 
              onClick={() => setIsPreview(false)}
              className="px-6 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50"
            >
              Back to Edit
            </button>
            <button 
              onClick={() => handleSave(true)}
              disabled={isSaving || savingToDrive}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-70"
            >
              {savingToDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
              {savingToDrive ? 'Saving to Drive...' : 'Save to Google Drive'}
            </button>
            <button 
              onClick={() => handleSave(false)}
              disabled={isSaving || savingToDrive}
              className="px-8 py-2 bg-brand text-white font-bold rounded-lg hover:bg-brand-hover shadow-lg shadow-brand/10 flex items-center gap-2 disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
              Finalize & Save Invoice
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-lg text-slate-800">{invoice ? 'Edit Invoice' : 'Create Invoice'}</h3>
            <p className="text-sm text-slate-500">
              {job ? `Job: ${job.customer_name} - ${job.address}` : 'Standalone Invoice'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {!job && !invoice && (
              <div className="flex items-center gap-2">
                <select 
                  value={selectedCustomerId || ''} 
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  className="text-sm border border-slate-300 rounded px-2 py-1 bg-white font-medium"
                >
                  <option value="">Select Customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowCustomerForm(true)}
                  className="text-xs font-bold text-brand bg-brand-light px-2 py-1 rounded hover:bg-brand/20 transition flex items-center gap-1"
                  title="New Customer"
                >
                  <PlusCircle className="w-3 h-3" />
                  New
                </button>
              </div>
            )}
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              className="text-sm border border-slate-300 rounded px-2 py-1 bg-white font-medium"
            >
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-brand animate-spin mb-4" />
              <p className="text-slate-600 font-medium">Gemini is analyzing job notes and materials...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Suggested Line Items
                </h4>
                <button 
                  onClick={handleAddItem}
                  className="text-sm text-brand font-medium hover:text-brand-hover"
                >
                  + Add Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-3 items-start p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="col-span-6">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Description</label>
                      <textarea 
                        value={item.description} 
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full p-2 text-sm border border-slate-300 rounded bg-white h-16"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Qty</label>
                      <input 
                        type="number" 
                        value={isNaN(item.quantity) ? '' : item.quantity} 
                        onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                        className="w-full p-2 text-sm border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Price</label>
                      <input 
                        type="number" 
                        value={isNaN(item.unit_price) ? '' : item.unit_price} 
                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                        className="w-full p-2 text-sm border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div className="col-span-2 flex flex-col items-end">
                      <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Total</label>
                      <div className="flex items-center gap-2 h-10">
                        <span className="text-sm font-bold text-slate-700">${item.amount.toFixed(2)}</span>
                        <button onClick={() => handleRemoveItem(index)} className="text-slate-400 hover:text-brand">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="text-right">
                  <p className="text-sm text-slate-500 uppercase font-bold tracking-wider">Subtotal</p>
                  <p className="text-3xl font-bold text-slate-900">${subtotal.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">+ 15% HST: ${tax.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button 
            onClick={() => setIsPreview(true)}
            disabled={isAnalyzing || items.length === 0}
            className="px-6 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition disabled:opacity-50 flex items-center gap-2"
          >
            Preview Invoice
          </button>
        </div>
      </div>

      {showCustomerForm && (
        <CustomerForm 
          onClose={() => setShowCustomerForm(false)}
          onSaved={(savedCustomer) => {
            fetchCustomers();
            if (savedCustomer) {
              setSelectedCustomerId(savedCustomer.id);
            }
            setShowCustomerForm(false);
          }}
        />
      )}
    </div>
  );
}
