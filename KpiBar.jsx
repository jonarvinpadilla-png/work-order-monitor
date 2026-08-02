import { useState } from 'react';
import { TYPE_COLOR, PRIORITY_COLOR, STATUS_COLOR, typeLabel, formatDate, isOverdue, PRIORITIES } from '../lib/constants';
import ActionButtons from './ActionButtons';

const COLUMNS = [
  { key: 'code', label: 'ID' },
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type' },
  { key: 'facility', label: 'Facility' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assigned_to', label: 'Assigned' },
  { key: 'due_date', label: 'Due' }
];

export default function LogView({ orders, deleteConfirmId, makeActions }) {
  const [sort, setSort] = useState({ key: 'due_date', dir: 'asc' });

  function toggleSort(key) {
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  const sorted = [...orders].sort((a, b) => {
    let av, bv;
    if (sort.key === 'priority') {
      av = PRIORITIES.indexOf(a.priority);
      bv = PRIORITIES.indexOf(b.priority);
    } else {
      av = a[sort.key] || '';
      bv = b[sort.key] || '';
    }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="table-wrap">
      <table className="wo-table">
        <thead>
          <tr>
            {COLUMNS.map(c => (
              <th key={c.key} className={sort.key === c.key ? 'sorted' : ''} onClick={() => toggleSort(c.key)}>
                {c.label} <span className="sort-arrow">{sort.key === c.key ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</span>
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(o => {
            const overdue = isOverdue(o);
            return (
              <tr key={o.id}>
                <td className="mono">{o.code}</td>
                <td>{o.title}</td>
                <td><span className={`chip chip-sm chip-${TYPE_COLOR[o.type]}`}>{typeLabel(o.type)}</span></td>
                <td>{o.facility}</td>
                <td><span className={`chip chip-sm chip-${PRIORITY_COLOR[o.priority]}`}>{o.priority}</span></td>
                <td><span className={`chip chip-sm chip-${STATUS_COLOR[o.status]}`}>{o.status}</span></td>
                <td>{o.assigned_to || '—'}</td>
                <td className={overdue ? 'overdue' : ''}>{o.due_date ? formatDate(o.due_date) : '—'}</td>
                <td className="row-actions">
                  <ActionButtons order={o} confirmingDelete={deleteConfirmId === o.id} {...makeActions(o)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
