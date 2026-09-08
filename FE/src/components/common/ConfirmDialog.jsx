import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

// Hop thoai xac nhan / nhap ly do dung chung - THAY cho window.confirm va
// window.prompt.
//
// Hop thoai cua trinh duyet in ten mien len dau ("localhost:3000 says..."),
// khong doi duoc chu, khong theo giao dien he thong, va Chrome con them o
// "khong hien hop thoai nay nua" - nguoi dung tick nham 1 lan la MOI buoc
// xac nhan ve sau bi bo qua im lang. Voi cac thao tac o day (khoa tai khoan,
// bao khach thay phu tung...) thi do la loi that su chu khong chi xau ma thoi.
//
// Cach dung:
//   const confirm = useConfirm();
//   const ok = await confirm({ title, message });                 -> true / false
//   const ly = await confirm({ ..., input: { required: true } }); -> chuoi hoac null
//   await confirm({ ..., hideCancel: true });                     -> chi bao tin
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  // Ham resolve cua Promise dang cho - giu o ref chu khong o state vi doi no
  // KHONG duoc lam render lai, va handler phai doc duoc gia tri moi nhat.
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    // Goi 2 lan lien tiep: dong hop thoai cu bang "huy" de ben goi truoc do
    // khong bi treo mai o await.
    if (resolveRef.current) resolveRef.current(null);
    resolveRef.current = resolve;
    setDialog(typeof options === 'string' ? { message: options } : (options || {}));
  }), []);

  const close = useCallback((value) => {
    setDialog(null);
    const resolveIt = resolveRef.current;
    resolveRef.current = null;
    if (resolveIt) resolveIt(value);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && <ConfirmBox dialog={dialog} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm phai nam trong <ConfirmProvider>');
  return ctx;
}

const TONES = {
  primary: { bg: '#eff6ff', color: '#2563eb', btn: '#2563eb' },
  danger: { bg: '#fee2e2', color: '#dc2626', btn: '#dc2626' },
  warning: { bg: '#fffbeb', color: '#d97706', btn: '#d97706' },
  success: { bg: '#f0fdf4', color: '#16a34a', btn: '#16a34a' },
};

const ICONS = {
  primary: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  danger: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  warning: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  success: <polyline points="20 6 9 17 4 12" />,
};

function ConfirmBox({ dialog, onClose }) {
  const {
    title = 'Xác nhận',
    message,
    detail,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy',
    tone = 'primary',
    hideCancel = false,
    input = null,
  } = dialog;
  const [value, setValue] = useState(input?.defaultValue || '');
  const firstFieldRef = useRef(null);
  const s = TONES[tone] || TONES.primary;
  // Bat buoc nhap ma con trong -> khoa nut xac nhan. window.prompt cu chan
  // bang `if (!note) return`, im lang; o day noi ro ngay tren man hinh.
  const thieuNoiDung = Boolean(input?.required) && !String(value).trim();

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  // Esc = huy o moi hop thoai; Enter = xac nhan (tru trong textarea, cho xuong dong).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(input ? null : false);
        return;
      }
      if (e.key === 'Enter' && !(input?.multiline !== false && e.target?.tagName === 'TEXTAREA')) {
        if (thieuNoiDung) return;
        e.preventDefault();
        onClose(input ? String(value).trim() : true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, input, value, thieuNoiDung]);

  const huy = () => onClose(input ? null : false);
  const dongY = () => onClose(input ? String(value).trim() : true);

  return (
    <div
      className="agc-confirm__overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) huy(); }}
    >
      <div className="agc-confirm__box">
        <div className="agc-confirm__head">
          <span className="agc-confirm__icon" style={{ background: s.bg, color: s.color }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              {ICONS[tone] || ICONS.primary}
            </svg>
          </span>
          <h3 className="agc-confirm__title">{title}</h3>
        </div>

        {message && <div className="agc-confirm__message">{message}</div>}
        {detail && <div className="agc-confirm__detail">{detail}</div>}

        {input && (
          <label className="agc-confirm__field">
            {input.label && <span className="agc-confirm__label">{input.label}</span>}
            {input.multiline !== false ? (
              <textarea
                ref={firstFieldRef}
                rows={input.rows || 3}
                placeholder={input.placeholder || ''}
                maxLength={input.maxLength || 500}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <input
                ref={firstFieldRef}
                type="text"
                placeholder={input.placeholder || ''}
                maxLength={input.maxLength || 200}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            )}
            {input.required && <span className="agc-confirm__hint">Bắt buộc nhập</span>}
          </label>
        )}

        <div className="agc-confirm__actions">
          {!hideCancel && (
            <button type="button" className="agc-confirm__btn agc-confirm__btn--ghost" onClick={huy}>
              {cancelText}
            </button>
          )}
          <button
            type="button"
            ref={input ? null : firstFieldRef}
            className="agc-confirm__btn"
            style={{ background: s.btn, borderColor: s.btn }}
            disabled={thieuNoiDung}
            onClick={dongY}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>{`
        .agc-confirm__overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 10000; padding: 16px;
          animation: agcConfirmFade 0.12s ease-out;
        }
        .agc-confirm__box {
          background: #fff; border-radius: 14px; padding: 20px 22px 18px;
          box-shadow: 0 24px 60px rgba(15,23,42,0.25);
          width: 100%; max-width: 440px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          animation: agcConfirmIn 0.14s ease-out;
        }
        .agc-confirm__head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .agc-confirm__icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
        }
        .agc-confirm__title { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
        .agc-confirm__message {
          font-size: 14px; color: #334155; line-height: 1.55; white-space: pre-line;
        }
        .agc-confirm__detail {
          margin-top: 8px; padding: 8px 10px; border-radius: 8px;
          background: #f8fafc; border: 1px solid #e2e8f0;
          font-size: 13px; color: #475569; line-height: 1.5; white-space: pre-line;
        }
        .agc-confirm__field { display: block; margin-top: 12px; }
        .agc-confirm__label { display: block; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 4px; }
        .agc-confirm__field textarea, .agc-confirm__field input {
          width: 100%; box-sizing: border-box; padding: 8px 10px;
          border: 1px solid #cbd5e1; border-radius: 8px;
          font-size: 14px; font-family: inherit; color: #0f172a; resize: vertical;
        }
        .agc-confirm__field textarea:focus, .agc-confirm__field input:focus {
          outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }
        .agc-confirm__hint { display: block; margin-top: 4px; font-size: 12px; color: #94a3b8; }
        .agc-confirm__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
        .agc-confirm__btn {
          padding: 9px 16px; border-radius: 9px; font-size: 14px; font-weight: 600;
          border: 1px solid transparent; cursor: pointer; color: #fff;
        }
        .agc-confirm__btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .agc-confirm__btn--ghost { background: #fff; color: #334155; border-color: #e2e8f0; }
        @keyframes agcConfirmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes agcConfirmIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
