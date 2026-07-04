import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginApi } from '../services/authApi';

const AppContext = createContext(null);

function loadSession() {
  try {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (token && raw) return { token, user: JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { token: null, user: null };
}

export function AppProvider({ children }) {
  const initial = loadSession();
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);

  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    }
  }, [token]);

  const login = async (email, password, remember = false) => {
    const result = await loginApi(email, password);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', result.token);
    storage.setItem('user', JSON.stringify(result.user));
    setToken(result.token);
    setUser(result.user);
    return result;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token && user), login, logout }),
    [token, user]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAuth must be used within AppProvider');
  return ctx;
}

export function useAppContext() {
  return useAuth();
}

export default AppContext;
