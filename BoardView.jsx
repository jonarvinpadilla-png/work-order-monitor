export default function Toast({ message, kind }) {
  if (!message) return null;
  return <div className={`toast${kind === 'error' ? ' toast-error' : ''}`}>{message}</div>;
}
