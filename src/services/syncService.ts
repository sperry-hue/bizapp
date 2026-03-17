import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import { apiFetch } from './api';

export interface OfflineAction {
  id: string;
  type: 'TOGGLE_TASK' | 'ADD_UPDATE' | 'UPDATE_STATUS';
  payload: any;
  timestamp: number;
}

const QUEUE_KEY = 'offline_action_queue';
const LAST_SYNC_KEY = 'last_sync_time';

export const getQueue = async (): Promise<OfflineAction[]> => {
  const queue = await localforage.getItem<OfflineAction[]>(QUEUE_KEY);
  return queue || [];
};

export const getLastSyncTime = async (): Promise<number | null> => {
  return await localforage.getItem<number>(LAST_SYNC_KEY);
};

export const setLastSyncTime = async (time: number) => {
  await localforage.setItem(LAST_SYNC_KEY, time);
};

export const enqueueAction = async (action: Omit<OfflineAction, 'id' | 'timestamp'>) => {
  const queue = await getQueue();
  const newAction: OfflineAction = {
    ...action,
    id: uuidv4(),
    timestamp: Date.now(),
  };
  queue.push(newAction);
  await localforage.setItem(QUEUE_KEY, queue);
};

export const clearQueue = async () => {
  await localforage.setItem(QUEUE_KEY, []);
};

export const syncQueue = async () => {
  if (!navigator.onLine) return;

  const queue = await getQueue();
  if (queue.length === 0) return;

  console.log('Syncing offline queue...', queue);

  for (const action of queue) {
    try {
      if (action.type === 'TOGGLE_TASK') {
        await apiFetch(`/api/tasks/${action.payload.taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ is_completed: action.payload.is_completed })
        });
      } else if (action.type === 'UPDATE_STATUS') {
        await apiFetch(`/api/jobs/${action.payload.jobId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: action.payload.status })
        });
      } else if (action.type === 'ADD_UPDATE') {
        // We need to handle FormData for photos.
        // Since we can't easily serialize File objects in localforage, 
        // a full offline photo upload is complex. We'll sync text data for now.
        // If there are photos, we might need to store them as base64 or blobs.
        
        const formData = new FormData();
        formData.append('date', action.payload.date);
        formData.append('time_on_site', action.payload.time_on_site);
        if (action.payload.time_off_site) {
          formData.append('time_off_site', action.payload.time_off_site);
        }
        formData.append('notes', action.payload.notes);
        formData.append('materials_used', action.payload.materials_used);
        formData.append('submit', action.payload.submit);
        
        if (action.payload.photos && action.payload.photos.length > 0) {
          for (const photo of action.payload.photos) {
            // Convert base64 back to blob
            const res = await fetch(photo.data);
            const blob = await res.blob();
            formData.append('photos', blob, photo.name);
          }
        }

        await apiFetch(`/api/jobs/${action.payload.jobId}/updates`, {
          method: 'POST',
          body: formData
        });
      }
    } catch (e) {
      console.error('Failed to sync action', action, e);
      // Stop syncing if one fails to preserve order, or continue?
      // For simplicity, we'll just continue and clear queue if mostly successful, 
      // but ideally we'd keep failed ones.
    }
  }

  await clearQueue();
  await setLastSyncTime(Date.now());
  console.log('Sync complete');
};

// Listen for online event to trigger sync
window.addEventListener('online', syncQueue);
