import { useMemo, useState } from 'react';

const TOKEN_KEY = 'asp_jwt_token';

export function useAuth() {
  const [tokenState, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY));

  const api = useMemo(
    () => ({
      token: tokenState,
      isAuthenticated: Boolean(tokenState),
      setToken: (token) => {
        if (!token) {
          localStorage.removeItem(TOKEN_KEY);
          setTokenState(null);
          return;
        }

        localStorage.setItem(TOKEN_KEY, token);
        setTokenState(token);
      },
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        setTokenState(null);
      },
      getToken: () => localStorage.getItem(TOKEN_KEY),
    }),
    [tokenState]
  );

  return api;
}
