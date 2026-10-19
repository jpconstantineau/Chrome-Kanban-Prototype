import { createInitialState, reducer, visibleCards, uid } from './state.js';
import { loadState, saveState } from './storage.js';
import { renderBoard, renderArchive, populateOptions, makeLabel, editLabel } from './view.js';
import { setupDragAndDrop } from './drag.js';
import { setupAI, renderChat } from './ai.js';

const $ = (id) => document.getElementById(id);
let state;
let writeQueue = Promise.resolve();
let draftLabels = [];
let toastTimer;
let cardSaving = false;
let columnSaving = false;
const filters = { search: '', label: '', assignee: '' };
export function notify(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
}

// Commit to IndexedDB before showing a successful change; a failed save keeps the previous state.
function dispatch(action) {
  const pending = writeQueue.then(async () => {
    $('save-status').textContent = 'Saving…';
    try {
      const next = reducer(state, action);
      await saveState(next);
      state = next;
      render();
      $('storage-error').hidden = true;
      $('save-status').textContent = 'Saved on this device';
    } catch (error) {
      $('save-status').textContent = 'Change was not saved';
      $('storage-error').textContent = `Could not save: ${error.message}. Your last saved board is unchanged. Try again when local storage is available.`;
      $('storage-error').hidden = false;
      throw error;
    }
  });
  writeQueue = pending.catch(() => {});
  return pending;
}
const perform = (action, message) => dispatch(action).then(() => { if (message) notify(message); }).catch((error) => notify(error.message));
const activeColumns = () => state.columns.filter((column) => !column.archived);

function render() {
  const focused = document.activeElement?.dataset.focus;
  document.documentElement.dataset.theme = state.preferences.theme;
  const light = state.preferences.theme === 'light';
  $('theme-toggle').textContent = light ? 'Dark mode' : 'Light mode';
  $('theme-toggle').setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
  document.querySelector('meta[name="theme-color"]').content = light ? '#d4d6d8' : '#202428';
  populateOptions($('label-filter'), [...new Set(visibleCards(state).flatMap((card) => card.labels.map((label) => label.name)))], 'All labels', filters.label);
  populateOptions($('assignee-filter'), [...new Set(visibleCards(state).map((card) => card.assignee).filter(Boolean))], 'All assignees', filters.assignee);
  $('clear-filters').hidden = !Object.values(filters).some(Boolean);
  renderBoard($('board'), state, filters);
  renderChat(state);
  const total = visibleCards(state).length;
  const shown = visibleCards(state, filters).length;
  const complete = visibleCards(state).filter((card) => activeColumns().find((column) => column.id === card.columnId)?.done).length;
  $('board-summary').textContent = `${shown} OF ${total} CARDS / ${complete} COMPLETE`;
  $('archive-count').textContent = state.columns.filter((column) => column.archived).length + state.cards.filter((card) => card.archived).length;
  if ($('archive-dialog').open) renderArchive($('archive-items'), state);
  if (focused) [...$('board').querySelectorAll('[data-focus]')].find((el) => el.dataset.focus === focused)?.focus();
}

function showCard(id, columnId) {
  if (!activeColumns().length) { showColumn(); notify('Add a column to give your card a home.'); return; }
  $('card-form').reset();
  const card = state.cards.find((item) => item.id === id);
  $('card-id').value = card?.id || '';
  $('card-dialog-title').textContent = card ? 'Edit card' : 'New card';
  $('card-title').value = card?.title || '';
  $('card-description').value = card?.description || '';
  $('card-assignee').value = card?.assignee || '';
  $('card-column').replaceChildren(...activeColumns().map((column) => new Option(column.name, column.id)));
  $('card-column').value = card?.columnId || columnId || activeColumns()[0].id;
  $('assignee-suggestions').replaceChildren(...[...new Set(state.cards.map((item) => item.assignee).filter(Boolean))].map((name) => new Option(name)));
  draftLabels = structuredClone(card?.labels || [{ name: 'Task', color: '#38bdf8' }]);
  renderDraftLabels();
  $('archive-card').hidden = !card;
  $('card-form-error').textContent = '';
  $('card-dialog').showModal();
  $('card-title').focus();
}
function renderDraftLabels() {
  $('card-labels').replaceChildren(...draftLabels.map((label, index) => {
    const wrapper = document.createElement('span'); wrapper.className = 'editable-label';
    const button = makeLabel(label); button.type = 'button';
    button.addEventListener('click', () => editLabel(button, label.name, (name) => { draftLabels[index].name = name; renderDraftLabels(); }));
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'remove-label'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove label ${label.name}`);
    remove.addEventListener('click', () => { draftLabels.splice(index, 1); renderDraftLabels(); });
    wrapper.append(button, remove); return wrapper;
  }));
}
function showColumn(id) {
  const column = state.columns.find((item) => item.id === id);
  $('column-form').reset(); $('column-id').value = column?.id || '';
  $('column-dialog-title').textContent = column ? 'Edit column' : 'New column';
  $('column-name').value = column?.name || ''; $('column-done').checked = column?.done || false;
  $('archive-column').hidden = !column; $('column-form-error').textContent = '';
  $('column-dialog').showModal(); $('column-name').focus();
}

$('new-card').onclick = () => showCard();
$('new-column').onclick = () => showColumn();
$('theme-toggle').onclick = () => perform({ type: 'preferences.update', preferences: { theme: state.preferences.theme === 'dark' ? 'light' : 'dark' } });
for (const [id, key] of [['search', 'search'], ['label-filter', 'label'], ['assignee-filter', 'assignee']]) $(id).addEventListener('input', () => { filters[key] = $(id).value; render(); });
$('clear-filters').onclick = () => { Object.keys(filters).forEach((key) => { filters[key] = ''; }); $('search').value = ''; render(); };
document.querySelectorAll('[data-close]').forEach((button) => { button.onclick = () => button.closest('dialog').close(); });
$('open-archive').onclick = () => { renderArchive($('archive-items'), state); $('archive-dialog').showModal(); };
$('archive-items').onclick = (event) => {
  const button = event.target.closest('[data-restore]');
  if (button) perform({ type: `${button.dataset.kind}.restore`, id: button.dataset.restore }, 'Restored to the board');
};
$('add-label').onclick = () => {
  const name = $('new-label-name').value.trim();
  if (!name) { $('new-label-name').focus(); return; }
  draftLabels.push({ name, color: $('new-label-color').value }); $('new-label-name').value = ''; renderDraftLabels();
};
$('card-form').onsubmit = async (event) => {
  event.preventDefault();
  if (cardSaving) return;
  cardSaving = true;
  const submit = $('card-form').querySelector('[type="submit"]'); submit.disabled = true;
  try {
    document.activeElement.blur();
    await dispatch({ type: 'card.save', card: { id: $('card-id').value || uid(), title: $('card-title').value.trim(), description: $('card-description').value, columnId: $('card-column').value, assignee: $('card-assignee').value.trim(), labels: structuredClone(draftLabels) } });
    $('card-dialog').close(); notify('Card saved');
  } catch (error) { $('card-form-error').textContent = error.message; }
  finally { cardSaving = false; submit.disabled = false; }
};
$('column-form').onsubmit = async (event) => {
  event.preventDefault();
  if (columnSaving) return;
  columnSaving = true;
  const submit = $('column-form').querySelector('[type="submit"]'); submit.disabled = true;
  try {
    await dispatch({ type: 'column.save', column: { id: $('column-id').value || uid(), name: $('column-name').value.trim(), done: $('column-done').checked } });
    $('column-dialog').close(); notify('Column saved');
  } catch (error) { $('column-form-error').textContent = error.message; }
  finally { columnSaving = false; submit.disabled = false; }
};
$('archive-card').onclick = async () => {
  try { await dispatch({ type: 'card.archive', id: $('card-id').value }); $('card-dialog').close(); notify('Card moved to archive'); }
  catch (error) { $('card-form-error').textContent = error.message; }
};
$('archive-column').onclick = async () => {
  try { await dispatch({ type: 'column.archive', id: $('column-id').value }); $('column-dialog').close(); notify('Column and its cards moved to archive'); }
  catch (error) { $('column-form-error').textContent = error.message; }
};
$('board').onclick = (event) => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.dataset.editCard) showCard(button.dataset.editCard);
  if (button.dataset.addCard) showCard(null, button.dataset.addCard);
  if (button.dataset.editColumn) showColumn(button.dataset.editColumn);
  if (button.dataset.columnMove) {
    const columns = activeColumns(); const index = columns.findIndex((column) => column.id === button.dataset.id);
    const target = index + Number(button.dataset.columnMove);
    perform({ type: 'column.move', id: button.dataset.id, beforeId: columns[target + (target > index ? 1 : 0)]?.id }, 'Column reordered');
  }
  if (button.dataset.cardOrder) {
    const card = state.cards.find((item) => item.id === button.dataset.id);
    const cards = state.cards.filter((item) => !item.archived && item.columnId === card.columnId);
    const index = cards.findIndex((item) => item.id === card.id); const target = index + Number(button.dataset.cardOrder);
    perform({ type: 'card.move', id: card.id, columnId: card.columnId, beforeId: cards[target + (target > index ? 1 : 0)]?.id }, 'Card reordered');
  }
  if (button.dataset.labelIndex !== undefined) {
    const card = state.cards.find((item) => item.id === button.dataset.id); const index = Number(button.dataset.labelIndex);
    editLabel(button, card.labels[index].name, (name) => {
      const labels = card.labels.map((label, i) => i === index ? { ...label, name } : label);
      perform({ type: 'card.save', card: { id: card.id, labels } }, 'Label saved');
    });
  }
};
setupDragAndDrop($('board'), (action) => perform(action, 'Board order updated'));

try {
  state = await loadState() || createInitialState();
  await saveState(state);
  render(); $('board').setAttribute('aria-busy', 'false'); $('save-status').textContent = 'Saved on this device';
  const cleanupAI = setupAI({ getState: () => state, dispatch, notify });
  window.addEventListener('pagehide', (event) => { if (!event.persisted) cleanupAI(); });
} catch (error) {
  $('board').setAttribute('aria-busy', 'false');
  $('storage-error').textContent = `Cannot open this workspace: ${error.message}. Enable browser storage and reload. Existing data has not been reset.`;
  $('storage-error').hidden = false; $('save-status').textContent = 'Storage unavailable';
  document.querySelectorAll('button, input, select, textarea').forEach((el) => { el.disabled = true; });
}
