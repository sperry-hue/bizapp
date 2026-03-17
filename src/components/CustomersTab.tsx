import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import { Link } from 'react-router-dom';
import { Contact, PlusCircle, Search, ChevronRight, Phone, MapPin, Mail, UserPlus } from 'lucide-react';
import { apiFetch } from '../services/api';
import CustomerForm from './CustomerForm';

export default function CustomersTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>(undefined);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await apiFetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error("Failed to fetch customers", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Contact className="w-6 h-6 text-brand" />
            Customer CRM
          </h2>
          <button 
            onClick={() => setShowForm(true)}
            className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-hover transition flex items-center gap-2 shadow-sm"
          >
            <UserPlus className="w-4 h-4" />
            New Customer
          </button>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search customers..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-700">Customer Name</th>
                <th className="p-4 font-semibold text-slate-700">Contact Info</th>
                <th className="p-4 font-semibold text-slate-700">Address</th>
                <th className="p-4 font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className="border-b border-slate-100 hover:bg-slate-50 transition group">
                  <td className="p-4">
                    <Link to={`/customer/${customer.id}`} className="font-medium text-slate-900 hover:text-brand transition">
                      {customer.name}
                    </Link>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-3 h-3" />
                        {customer.phone}
                      </div>
                      {customer.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 max-w-xs truncate">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {customer.address}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowForm(true);
                        }}
                        className="p-2 text-slate-400 hover:text-brand hover:bg-brand-light rounded transition"
                        title="Edit Customer"
                      >
                        <PlusCircle className="w-5 h-5 rotate-45" />
                      </button>
                      <Link 
                        to={`/customer/${customer.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-hover transition"
                      >
                        View Profile
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    {searchTerm ? 'No customers match your search.' : 'No customers found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {showForm && (
        <CustomerForm 
          customer={selectedCustomer}
          onClose={() => {
            setShowForm(false);
            setSelectedCustomer(undefined);
          }}
          onSaved={fetchCustomers}
        />
      )}
    </div>
  );
}
