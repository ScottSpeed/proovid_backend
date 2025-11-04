import axios from 'axios';

// Backend API base URL - proovid.ai domain configuration
const API_BASE_URL = import.meta.env.PROD
  ? 'https://proovid.ai/api' 
  : 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for handling auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('jwt_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials);
    const { token } = response.data;
    
    if (token) {
      localStorage.setItem('jwt_token', token);
    }
    
    return response.data;
  },

  async logout(): Promise<void> {
    localStorage.removeItem('jwt_token');
    window.location.href = '/';
  },

  isAuthenticated(): boolean {
    const token = localStorage.getItem('jwt_token');
    return !!token;
  },

  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  },
};

export default api;