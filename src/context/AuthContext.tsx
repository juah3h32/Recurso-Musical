import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'rm_app_token';
const BASE = 'https://api.recursomusical.com.mx/rm-api/api.php';
const APP_SECRET = 'rm_app_2024_public';

interface AuthCtx {
  ready: boolean;
  token: string | null;
}

const Ctx = createContext<AuthCtx>({ ready: false, token: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let t = await AsyncStorage.getItem(TOKEN_KEY);
        if (!t) {
          const res = await fetch(`${BASE}?action=appToken&secret=${APP_SECRET}`, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
            },
          });
          const text = await res.text();
          let data: any;
          try { data = JSON.parse(text); } catch { data = {}; }
          if (data.ok) {
            t = data.token;
            await AsyncStorage.setItem(TOKEN_KEY, t!);
          }
        }
        setToken(t);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  return <Ctx.Provider value={{ ready, token }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
