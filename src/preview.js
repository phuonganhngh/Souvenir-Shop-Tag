// Preview follows print selection; editing an unchecked item does not add it.
export function renderSelectedPreview(root, items, activeId, renderTag, blankTag) {
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const wrapper = document.createElement('div');
    wrapper.className = `preview-item${item.id === activeId ? ' preview-current' : ''}`;
    wrapper.dataset.previewId = item.id;
    wrapper.innerHTML = renderTag(item);
    fragment.append(wrapper);
  }
  if (!items.length) {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-item preview-blank';
    wrapper.innerHTML = blankTag;
    fragment.append(wrapper);
  }
  root.replaceChildren(fragment);
  const current = root.querySelector('.preview-current');
  if (current) root.scrollTop += current.getBoundingClientRect().top - root.getBoundingClientRect().top;
  else root.scrollTop = 0;
}
