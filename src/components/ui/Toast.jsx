import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ICONS = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
};

const COLORS = {
  success: 'var(--green)',
  error:   'var(--red)',
  warning: 'var(--gold)',
  info:    'var(--blue)',
};

export function ToastContainer({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 9999, maxWidth: 360,
    }}>
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  );
}

function Toast({ toast, onClose }) {
  const Icon = ICONS[toast.type] || Info;
  const color = COLORS[toast.type] || COLORS.info;
  return (
    <div className="toast-item" style={{ '--toast-color': color }}>
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13 }}>{toast.message}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', color: 'var(--text-muted)' }}
      >
        <X size={13} />
      </button>
    </div>
  );
}
