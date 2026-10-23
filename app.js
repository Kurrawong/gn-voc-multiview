import { parseVocabulary, labelsFor, viewFor, conceptInformation } from './vocabulary.js';
const jurisdiction = document.querySelector('#jurisdiction');
const hierarchy = document.querySelector('#hierarchy');
const status = document.querySelector('#status');
const expand = document.querySelector('#expand');
const collapse = document.querySelector('#collapse');
let vocabulary;
const modal = document.querySelector('#concept-modal');
const modalTitle = document.querySelector('#concept-title');
const modalFields = document.querySelector('#concept-fields');
document.querySelector('#close-modal').addEventListener('click', () => modal.close());
modal.addEventListener('click', event => { if (event.target === modal) {
  const rect = modal.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close();
} });
function showConcept(id) {
  const info = conceptInformation(vocabulary.concepts.get(id), jurisdiction.value);
  modalTitle.textContent = info.label;
  modalFields.replaceChildren();
  for (const [name, values] of [['Label', [info.label]], ['Alternative Label', info.alternatives], ['Notation', info.notations], ['Definition', info.definitions], ['Creator', info.creators]]) {
    const term = document.createElement('dt');
    term.textContent = name;
    const value = document.createElement('dd');
    if (!values.length) value.textContent = '—';
    for (const text of values) {
      const line = document.createElement('p');
      line.textContent = text;
      value.append(line);
    }
    modalFields.append(term, value);
  }
  modal.showModal();
}
function conceptLink(id, label) {
  const link = document.createElement('a');
  link.href = id;
  link.textContent = label;
  link.setAttribute('aria-haspopup', 'dialog');
  link.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    showConcept(id);
  });
  return link;
}
function render() {
  if (!vocabulary) return;
  const { included, roots } = viewFor(vocabulary, jurisdiction.value);
  const label = id => labelsFor(vocabulary.concepts.get(id), jurisdiction.value);
  const sorted = ids => [...ids].sort((a, b) => label(a).localeCompare(label(b), 'en'));
  function branch(ids, ancestors = new Set()) {
    const list = document.createElement('ul');
    for (const id of sorted(ids)) {
      if (ancestors.has(id)) continue;
      const item = document.createElement('li');
      const children = [...vocabulary.concepts.get(id).children].filter(child => included.has(child) && !ancestors.has(child));
      if (children.length) {
        const details = document.createElement('details');
        details.open = true;
        const summary = document.createElement('summary');
        summary.append(conceptLink(id, label(id)));
        details.append(summary, branch(children, new Set([...ancestors, id])));
        item.append(details);
      } else {
        const text = conceptLink(id, label(id));
        text.className = 'leaf';
        item.append(text);
      }
      list.append(item);
    }
    return list;
  }
  hierarchy.replaceChildren(branch(roots));
  status.textContent = `${included.size} concepts · ${jurisdiction.selectedOptions[0].textContent}`;
  document.querySelector('#view-description').textContent = jurisdiction.value === 'national'
    ? 'National concepts. Preferred labels are displayed.'
    : jurisdiction.value === 'all' ? 'All concepts, regardless of creator. Preferred labels are displayed.'
    : 'National and jurisdiction concepts. Matching typed alternative labels are displayed, with preferred-label fallback.';
  expand.disabled = collapse.disabled = !hierarchy.querySelector('details');
}
jurisdiction.addEventListener('change', render);
expand.addEventListener('click', () => hierarchy.querySelectorAll('details').forEach(node => node.open = true));
collapse.addEventListener('click', () => hierarchy.querySelectorAll('details').forEach(node => node.open = false));
expand.disabled = collapse.disabled = true;
fetch('./gn-status-types.ttl').then(response => {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}).then(turtle => { vocabulary = parseVocabulary(turtle); render(); }).catch(error => {
  status.textContent = `Unable to load the vocabulary (${error.message}). Serve this folder through a local HTTP server and reload.`;
  status.setAttribute('role', 'alert');
});
