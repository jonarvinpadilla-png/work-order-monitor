import { useEffect, useRef, useState } from 'react';
import { FACILITIES, TYPES, PRIORITIES, STATUSES, REFERENCE_SUGGESTIONS, todayStr } from '../lib/constants';
import { Icon } from '../lib/icons';

const BLANK = {
  title: '', description: '', type: TYPES[0].key, facility: FACILITIES[0], location: '', equipment: '',
  priority: 'Medium', status: 'Open', assigned_to: '', reported_by: '', date_reported: todayStr(), due_date: '',
  reference: '', notes: ''
};

export default function WorkOrderModal({ order, onSave, onClose }) {
  const [form, setForm] = useState(order ? { ...BLANK, ...order } : BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const firstInput = useRef(null);

  useEffect(() => {
    firstInput.current?.focus();
    function onEsc(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.type || !form.facility || !form.priority || !form.due_date) {
      setErr('Please fill in all required fields.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      await onSave(form);
    } catch (ex) {
      setErr(ex.message || 'Something went wrong saving this work order.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{order ? 'Edit Work Order' : 'New Work Order'}</h2>
          <button className="ibtn" onClick={onClose} aria-label="Close"><Icon.X /></button>
        </div>
        {err && <div className="auth-error">{err}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Title <span className="req">*</span>
              <input ref={firstInput} type="text" required value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. Dock leveler hydraulic leak" />
            </label>
          </div>
          <div className="form-row">
            <label>Description
              <textarea rows={2} value={form.description || ''} onChange={e => update('description', e.target.value)} placeholder="What is happening, where, and any relevant detail" />
            </label>
          </div>
          <div className="form-grid">
            <label>Type <span className="req">*</span>
              <select value={form.type} onChange={e => update('type', e.target.value)}>
                {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <label>Priority <span className="req">*</span>
              <select value={form.priority} onChange={e => update('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>Facility <span className="req">*</span>
              <select value={form.facility} onChange={e => update('facility', e.target.value)}>
                {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label>Status
              <select value={form.status} onChange={e => update('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Location
              <input type="text" value={form.location || ''} onChange={e => update('location', e.target.value)} placeholder="e.g. Dock Door 3" />
            </label>
            <label>Equipment / Asset
              <input type="text" value={form.equipment || ''} onChange={e => update('equipment', e.target.value)} placeholder="e.g. Ammonia Compressor #2" />
            </label>
            <label>Assigned to
              <input type="text" value={form.assigned_to || ''} onChange={e => update('assigned_to', e.target.value)} placeholder="Technician or vendor" />
            </label>
            <label>Reported by
              <input type="text" value={form.reported_by || ''} onChange={e => update('reported_by', e.target.value)} placeholder="Name" />
            </label>
            <label>Date reported
              <input type="date" value={form.date_reported || ''} onChange={e => update('date_reported', e.target.value)} />
            </label>
            <label>Due date <span className="req">*</span>
              <input type="date" required value={form.due_date || ''} onChange={e => update('due_date', e.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>Reference / standard
              <input type="text" list="ref-suggestions" value={form.reference || ''} onChange={e => update('reference', e.target.value)} placeholder="e.g. RA 11058, HIRAC ref, incident #" />
              <datalist id="ref-suggestions">
                {REFERENCE_SUGGESTIONS.map(r => <option value={r} key={r} />)}
              </datalist>
            </label>
          </div>
          <div className="form-row">
            <label>Notes
              <textarea rows={2} value={form.notes || ''} onChange={e => update('notes', e.target.value)} placeholder="Resolution notes, parts used, follow-up" />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : order ? 'Save changes' : 'Create work order'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
