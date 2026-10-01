import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokens } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const refreshCart = useCallback(async () => {
    try {
      setCartCount((await api('/cart')).itemCount);
    } catch {
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (tokens.access || tokens.refresh) {
        try {
          setUser(await api('/auth/me'));
        } catch {
          tokens.clear();
        }
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (user) refreshCart();
    else setCartCount(0);
  }, [user, refreshCart]);

  const authenticate = async (path, body) => {
    const data = await api(path, { method: 'POST', body });
    tokens.set(data);
    setUser(data.user);
  };

  const value = {
    user,
    ready,
    cartCount,
    refreshCart,
    login: (email, password) => authenticate('/auth/login', { email, password }),
    register: (name, email, password) => authenticate('/auth/register', { name, email, password }),
    logout: async () => {
      try {
        if (tokens.refresh) await api('/auth/logout', { method: 'POST', body: { refreshToken: tokens.refresh } });
      } catch { /* token may already be invalid */ }
      tokens.clear();
      setUser(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
