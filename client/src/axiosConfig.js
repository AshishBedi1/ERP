import axios from 'axios';

/**
 * Production (Vercel):
 * - Prefer VITE_API_URL = your Render API origin (e.g. https://erp-auth.onrender.com) in Vercel env.
 * - Or leave unset and use client/vercel.json rewrite so /api proxies to Render (same-origin in browser).
 * Dev: leave unset — Vite proxies /api to the local server.
 */
const origin = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || '';
axios.defaults.baseURL = origin;
