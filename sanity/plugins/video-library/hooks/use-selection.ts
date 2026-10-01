import { useCallback, useEffect, useRef, useState } from "react";

export interface Selection {
  ids: string[];
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string, extend?: boolean) => void;
  selectAll: () => void;
  clear: () => void;
}

/**
 * Multi-selection over the currently visible assets.
 *
 * `orderedIds` is the list as rendered, which is what makes shift-click mean
 * "everything between the last click and this one" rather than "everything
 * between two document ids".
 */
export function useSelection(orderedIds: string[]): Selection {
  const [ids, setIds] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);

  // Assets can vanish — deleted here, or by someone else in another tab.
  // Dropping them keeps a bulk action from targeting documents that are gone.
  useEffect(() => {
    setIds((current) => {
      const next = current.filter((id) => orderedIds.includes(id));

      return next.length === current.length ? current : next;
    });
  }, [orderedIds]);

  const toggle = useCallback(
    (id: string, extend = false) => {
      setIds((current) => {
        if (extend && anchor.current) {
          const from = orderedIds.indexOf(anchor.current);
          const to = orderedIds.indexOf(id);

          if (from !== -1 && to !== -1) {
            const range = orderedIds.slice(
              Math.min(from, to),
              Math.max(from, to) + 1,
            );

            return Array.from(new Set([...current, ...range]));
          }
        }

        anchor.current = id;

        return current.includes(id)
          ? current.filter((value) => value !== id)
          : [...current, id];
      });
    },
    [orderedIds],
  );

  const selectAll = useCallback(() => setIds(orderedIds), [orderedIds]);

  const clear = useCallback(() => {
    anchor.current = null;
    setIds([]);
  }, []);

  return {
    ids,
    count: ids.length,
    isSelected: (id) => ids.includes(id),
    toggle,
    selectAll,
    clear,
  };
}
