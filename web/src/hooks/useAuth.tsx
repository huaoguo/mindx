import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { api, setApiKey, getApiKey, type User } from '../lib/api';

interface AuthCtx {
  user: { name: string } | null;
  login: (name: string, password: string) => Promise<void>;
  register: (name: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ name: string } | null>(() => {
    const name = localStorage.getItem('userName');
    const key = getApiKey();
    return name && key ? { name } : null;
  });

  const login = useCallback(async (name: string, password: string) => {
    const data: User = await api.login(name, password);
    setApiKey(data.key);
    localStorage.setItem('userName', data.name);
    setUser({ name: data.name });
  }, []);

  const register = useCallback(async (name: string, password: string) => {
    const data: User = await api.register(name, password);
    setApiKey(data.key);
    localStorage.setItem('userName', data.name);
    setUser({ name: data.name });
  }, []);

  const logout = useCallback(() => {
    setApiKey(null);
    localStorage.removeItem('userName');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
