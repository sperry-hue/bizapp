import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Image as ImageIcon, Calendar, Briefcase } from 'lucide-react';
import { apiFetch } from '../services/api';

interface PhotoWithJob {
  id: number;
  job_id: number;
  drive_file_id?: string;
  drive_url?: string;
  local_path?: string;
  customer_name: string;
  job_created_at: string;
}

export default function PhotosTab() {
  const [photos, setPhotos] = useState<PhotoWithJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      const res = await apiFetch('/api/photos');
      const data = await res.json();
      setPhotos(data);
    } catch (error) {
      console.error("Failed to fetch photos", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading photos...</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
        <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-800 mb-2">No Photos Found</h3>
        <p className="text-slate-500">Photos uploaded by technicians will appear here.</p>
      </div>
    );
  }

  // Group photos by job
  const groupedPhotos = photos.reduce<Record<string, { job_id: number, customer_name: string, date: string, photos: PhotoWithJob[] }>>((acc, photo) => {
    const key = `${photo.job_id}-${photo.customer_name}`;
    if (!acc[key]) {
      acc[key] = {
        job_id: photo.job_id,
        customer_name: photo.customer_name,
        date: new Date(photo.job_created_at).toLocaleDateString(),
        photos: []
      };
    }
    acc[key].photos.push(photo);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {(Object.values(groupedPhotos) as Array<{ job_id: number, customer_name: string, date: string, photos: PhotoWithJob[] }>).map((group) => (
        <div key={group.job_id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-slate-400" />
                {group.customer_name}
              </h3>
              <span className="text-sm text-slate-500 flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {group.date}
              </span>
            </div>
            <Link 
              to={`/job/${group.job_id}`}
              className="text-sm font-medium text-brand hover:text-brand-hover transition"
            >
              View Job
            </Link>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {group.photos.map((photo) => (
                <a 
                  key={photo.id} 
                  href={photo.drive_url || photo.local_path} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 hover:border-brand/40 transition-colors"
                >
                  <img 
                    src={photo.local_path || (photo.drive_file_id ? `https://drive.google.com/uc?export=view&id=${photo.drive_file_id}` : photo.drive_url)} 
                    alt={`Photo for job ${photo.job_id}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
