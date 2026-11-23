import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getStoredUser, restoreSession, subscribeAuth, updateStoredUser } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [isRestoring, setIsRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeAuth(setUser);
    restoreSession()
      .then((restoredUser) => {
        if (active) setUser(restoredUser);
      })
      .catch((error) => {
        if (active) {
          setRestoreError(error.message);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setIsRestoring(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const updateUser = useCallback((nextUser) => {
    updateStoredUser(nextUser);
    setUser(nextUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, updateUser, isRestoring, restoreError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext) || {
    user: getStoredUser(),
    updateUser: updateStoredUser,
    isRestoring: false,
    restoreError: ''
  };
}
