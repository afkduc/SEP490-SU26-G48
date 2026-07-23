import { createContext, useContext, useState, useCallback } from 'react';

const GlobalErrorContext = createContext(null);

export function GlobalErrorProvider({ children }) {
  const [globalError, setGlobalError] = useState(null);

  const set403Error = useCallback((permissionKey, message) => {
    setGlobalError({
      type: 'FORBIDDEN',
      status: 403,
      permissionKey,
      message,
    });
  }, []);

  const clearError = useCallback(() => {
    setGlobalError(null);
  }, []);

  return (
    <GlobalErrorContext.Provider value={{ globalError, set403Error, clearError }}>
      {children}
    </GlobalErrorContext.Provider>
  );
}

export function useGlobalError() {
  const ctx = useContext(GlobalErrorContext);
  if (!ctx) {
    return { globalError: null, set403Error: () => {}, clearError: () => {} };
  }
  return ctx;
}
