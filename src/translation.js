export const languageKeys = ['en', 'ko', 'zh', 'tw'];

export function translationTasks(products) {
  return products.filter(product => String(product.ja || '').trim()).map(product => ({
    id: product.id,
    ja: product.ja,
    missing: languageKeys.filter(key => !String(product[key] || '').trim()),
  })).filter(product => product.missing.length);
}

export function applyTranslations(products, results, decode = value => value) {
  let count = 0;
  for (const result of results) {
    const product = products.find(p => p.id === result.id);
    // Preserve edits made while a request was running, and ignore replaced/deleted rows.
    if (!product || product.ja !== result.ja) continue;
    for (const key of languageKeys) {
      if (!String(product[key] || '').trim() && typeof result[key] === 'string' && result[key].trim()) {
        product[key] = decode(result[key]); count++;
      }
    }
  }
  return count;
}

export function translationBatches(tasks) {
  const batches = [];
  let batch = [], length = 0;
  for (const task of tasks) {
    const size = task.ja.length * task.missing.length;
    if (batch.length && (batch.length === 50 || length + size > 20000)) {
      batches.push(batch); batch = []; length = 0;
    }
    batch.push(task); length += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}
