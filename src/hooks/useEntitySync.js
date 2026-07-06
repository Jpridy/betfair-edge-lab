import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Loads a collection from the database, subscribes to realtime updates,
 * and exposes CRUD helpers that persist back to the database.
 *
 * @param {string} entityName - Entity name (e.g. "PaperOrder")
 * @param {object} opts - { sort, limit, filter }
 */
export function useEntitySync(entityName, opts = {}) {
  const { sort = '-created_date', limit = 200, filter = {} } = opts;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedRef = useRef(false);

  // Initial load + realtime subscription
  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await base44.entities[entityName].filter(filter, sort, limit);
        if (cancelled) return;
        setItems(data || []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load');
      } finally {
        if (!cancelled) { setLoading(false); loadedRef.current = true; }
      }
    };

    load();

    // Realtime subscription
    try {
      unsub = base44.entities[entityName].subscribe((event) => {
        if (!loadedRef.current) return;
        setItems(prev => {
          if (event.type === 'create') {
            return [event.data, ...prev].slice(0, limit);
          }
          if (event.type === 'update') {
            return prev.map(i => i.id === event.data.id ? { ...i, ...event.data } : i);
          }
          if (event.type === 'delete') {
            return prev.filter(i => i.id !== event.data.id);
          }
          return prev;
        });
      });
    } catch (_) { /* subscription optional */ }

    return () => { cancelled = true; if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityName]);

  const create = useCallback(async (data) => {
    const created = await base44.entities[entityName].create(data);
    return created;
  }, [entityName]);

  const update = useCallback(async (id, data) => {
    const updated = await base44.entities[entityName].update(id, data);
    return updated;
  }, [entityName]);

  const remove = useCallback(async (id) => {
    await base44.entities[entityName].delete(id);
  }, [entityName]);

  const deleteMany = useCallback(async (query) => {
    await base44.entities[entityName].deleteMany(query);
  }, [entityName]);

  return { items, setItems, loading, error, create, update, remove, deleteMany };
}