import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const TOKEN_KEY = 'asp_jwt_token';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export async function login(payload) {
  const { data } = await apiClient.post('/auth/login', payload);
  return data;
}

export async function register(payload) {
  const { data } = await apiClient.post('/auth/register', payload);
  return data;
}

export async function uploadScan(file, onUploadProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post('/scan', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress,
  });

  return data;
}

export async function getScans() {
  const { data } = await apiClient.get('/scans');
  return data;
}

export async function getScanDetails(scanId) {
  const [scanResponse, resultsResponse] = await Promise.all([
    apiClient.get(`/scans/${scanId}`),
    apiClient.get('/results', { params: { scanId } }),
  ]);

  return {
    scan: scanResponse.data.scan,
    results: resultsResponse.data.results,
    statistics: resultsResponse.data.statistics,
  };
}

export default apiClient;
