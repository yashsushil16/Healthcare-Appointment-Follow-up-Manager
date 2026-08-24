// API Configuration Helper for Local & Cloud Deployments (Render / Vercel)
const API_BASE = import.meta.env.VITE_API_URL || '';

export function getApiUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${cleanPath}`;
}
