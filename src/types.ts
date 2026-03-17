export interface User {
  id: number;
  username: string;
  role: 'admin' | 'tech';
  google_calendar_id?: string;
  hourly_rate?: number;
}

export interface PayrollEntry {
  tech_id: number;
  username: string;
  total_hours: number;
  hourly_rate: number;
  total_pay: number;
  updates: JobUpdate[];
}

export interface Job {
  id: number;
  customer_name: string;
  address: string;
  phone: string;
  notes: string;
  status: 'New' | 'In Progress' | 'Pending Parts' | 'Completed';
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  job_type?: 'New Build' | 'Service Call' | 'Commercial' | 'Warranty';
  assigned_to: number | null;
  assigned_to_name?: string;
  assigned_techs?: number[];
  scheduled_date?: string;
  customer_id?: number;
  job_site_id?: number;
  invoice_id?: number;
  created_at: string;
  photos?: Photo[];
}

export interface JobSite {
  id: number;
  customer_id: number;
  name: string;
  address: string;
}

export interface Task {
  id: number;
  job_id: number;
  description: string;
  is_completed: boolean;
}

export interface JobUpdate {
  id: number;
  job_id: number;
  tech_id: number;
  tech_name: string;
  date: string;
  time_on_site: string;
  time_off_site?: string;
  notes: string;
  materials_used: string;
  location?: string;
  customer_name?: string;
  created_at: string;
}

export interface Photo {
  id: number;
  job_id: number;
  drive_file_id?: string;
  drive_url?: string;
  local_path?: string;
}

export interface Customer {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  created_at: string;
}

export interface Invoice {
  id: number;
  customer_id: number;
  job_id: number;
  amount: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue';
  created_at: string;
  customer_name?: string;
  job_address?: string;
  drive_url?: string;
  public_token?: string;
}

export interface InvoiceItem {
  id?: number;
  invoice_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  category?: string;
}

export interface Estimate {
  id: number;
  customer_id: number;
  job_id?: number;
  amount: number;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Declined';
  created_at: string;
  customer_name?: string;
  job_address?: string;
  drive_url?: string;
  public_token?: string;
}

export interface EstimateItem {
  id?: number;
  estimate_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface PhotoComment {
  id: number;
  photo_id: number;
  user_id: number;
  username: string;
  text: string;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  content: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export interface Message {
  id: number;
  user_id: number;
  username: string;
  role: string;
  text: string;
  created_at: string;
}

export interface Settings {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  app_icon_url?: string;
  hst_number: string;
  payment_info: string;
  google_drive_tokens?: string;
  google_calendar_tokens?: string;
}
