import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={{ toast, toasts, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx.toast;
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

const ICONS = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

const STYLES = {
  success: { bg: '#f4f4f5', border: '#3f3f46', color: '#3f3f46', iconColor: '#3f3f46' },
  error:   { bg: '#e4e4e7', border: '#27272a', color: '#27272a', iconColor: '#27272a' },
  warning: { bg: '#f4f4f5', border: '#52525b', color: '#52525b', iconColor: '#52525b' },
  info:    { bg: '#f4f4f5', border: '#3f3f46', color: '#3f3f46', iconColor: '#3f3f46' },
};

function ToastItem({ toast, onRemove }) {
  const s = STYLES[toast.type] || STYLES.info;
  return (
    <div
      style={{
        pointerEvents: 'all',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: `4px solid ${s.border}`,
        borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
        minWidth: '280px',
        maxWidth: '380px',
        animation: 'toastIn 0.2s ease-out',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: '0.875rem',
        fontWeight: 500,
        color: s.color,
      }}
    >
      <span style={{ color: s.iconColor, flexShrink: 0 }}>{ICONS[toast.type]}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: s.iconColor, padding: '2px', borderRadius: '4px',
          display: 'flex', alignItems: 'center', opacity: 0.6,
          flexShrink: 0,
        }}
        title="Đóng"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
