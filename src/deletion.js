// Keep only removed rows, so Undo does not overwrite later edits to other rows.
export function deleteSelected(rows) {
  const entries = rows.flatMap((item, index) => item.selected ? [{ item, nextId: rows[index + 1]?.id ?? null }] : []);
  return { rows: rows.filter(item => !item.selected), action: { entries } };
}
export function restoreDeleted(rows, action) {
  const restored = [...rows];
  for (const { item, nextId } of [...action.entries].reverse()) {
    if (restored.some(row => row.id === item.id)) continue;
    const nextIndex = restored.findIndex(row => row.id === nextId);
    restored.splice(nextIndex < 0 ? restored.length : nextIndex, 0, item);
  }
  return restored;
}
export function readDeletionHistory(value) {
  return Array.isArray(value) ? value.filter(action => Array.isArray(action?.entries) && action.entries.length && action.entries.every(entry => typeof entry?.item?.id === 'string' && (entry.nextId === null || typeof entry.nextId === 'string'))) : [];
}
