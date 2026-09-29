import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Icon } from '../lib/icons';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const toast = useCallback((message, kind = 'ok') => {
    const id = ++seq.current;
    setItems(list => [...list.slice(-2), { id, message, kind }]);
    setTimeout(() => setItems(list => list.filter(t => t.id !== id)), kind === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            {t.kind === 'error' ? <Icon.Alert /> : <Icon.CheckCircle />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Wraps an async action: tracks busy state, shows a success message or the error.
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, success) => {
    setBusy(true);
    try {
      const result = await fn();
      if (success) toast(typeof success === 'function' ? success(result) : success);
      return result;
    } catch (e) {
      toast(e.message || 'Something went wrong.', 'error');
      return undefined;
    } finally {
      setBusy(false);
    }
  }, [toast]);
  return [run, busy];
}
