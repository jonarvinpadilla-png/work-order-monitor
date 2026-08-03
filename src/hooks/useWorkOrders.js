import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export function useWorkOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setOrders(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    // Live-update the board when any teammate creates/edits/deletes a work order
    const channel = supabase
      .channel('work_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => {
        fetchOrders();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchOrders]);

  async function createOrder(payload) {
    const { error } = await supabase.from('work_orders').insert([payload]);
    if (error) throw error;
  }

  async function updateOrder(id, payload) {
    const { error } = await supabase.from('work_orders').update(payload).eq('id', id);
    if (error) throw error;
  }

  async function deleteOrder(id) {
    const { error } = await supabase.from('work_orders').delete().eq('id', id);
    if (error) throw error;
  }

  return { orders, loading, error, createOrder, updateOrder, deleteOrder, refetch: fetchOrders };
}
