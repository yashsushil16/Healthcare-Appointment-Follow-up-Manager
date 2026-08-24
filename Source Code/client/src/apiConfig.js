// API Configuration Helper for Local & Cloud Deployments (Render / Vercel)
let API_BASE = import.meta.env.VITE_API_URL || '';

if (!API_BASE && typeof window !== 'undefined') {
  const host = window.location.hostname;
  if (host.includes('vercel.app')) {
    API_BASE = 'https://healthcare-appointment-follow-up-manager-fmzs.onrender.com';
  }
}

export function getApiUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}
