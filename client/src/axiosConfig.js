import axios from 'axios';

/**
 * Production (Vercel): set VITE_API_URL to your API origin, e.g. https://your-app.onrender.com
 * Dev: leave unset — Vite proxies /api to the local server.
 */
const origin = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || '';
axios.defaults.baseURL = origin;
