
export async function apiFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('session_token');
  
  // Ensure relative URLs are absolute to avoid issues in some iframe contexts
  const origin = window.location.origin && window.location.origin !== 'null' 
    ? window.location.origin 
    : window.location.protocol + '//' + window.location.host;
  const absoluteUrl = url.startsWith('http') ? url : `${origin}${url}`;
  
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('X-Session-Token', token);
  }
  
  // Default to JSON if no content-type is set and body is present
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(absoluteUrl, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      // Session expired or invalid
      localStorage.removeItem('session_token');
      
      // If we're checking auth status, don't treat 401 as a hard error/redirect
      // This avoids noisy console errors on initial load when not logged in
      if (url.includes('/api/me') || url.includes('/api/login')) {
        return response;
      }

      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
      throw new Error('Session expired');
    }

    return response;
  } catch (error) {
    console.error(`apiFetch error for ${url}:`, error);
    throw error;
  }
}
