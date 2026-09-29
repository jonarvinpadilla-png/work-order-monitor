import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import WorkOrderForm from '../pages/WorkOrderForm';
import RequestForm from '../pages/RequestForm';

// "New work order" and "Report a problem" can be started from anywhere
// (sidebar, asset pages, MHE cards), optionally pre-filled.
const Ctx = createContext({ newWorkOrder: () => {}, editWorkOrder: () => {}, newRequest: () => {} });
export const useGlobalActions = () => useContext(Ctx);

export function GlobalActionsProvider({ children }) {
  const [wo, setWo] = useState(null);       // { order?, prefill? }
  const [request, setRequest] = useState(null);

  const newWorkOrder = useCallback((prefill = {}) => setWo({ prefill }), []);
  const editWorkOrder = useCallback(order => setWo({ order }), []);
  const newRequest = useCallback((prefill = {}) => setRequest({ prefill }), []);
  const value = useMemo(() => ({ newWorkOrder, editWorkOrder, newRequest }), [newWorkOrder, editWorkOrder, newRequest]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {wo && <WorkOrderForm order={wo.order} prefill={wo.prefill} onClose={() => setWo(null)} />}
      {request && <RequestForm prefill={request.prefill} onClose={() => setRequest(null)} />}
    </Ctx.Provider>
  );
}
