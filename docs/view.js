import { visibleCards } from './state.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function action(text, label, data) {
  const button = element('button', 'text-button', text);
  button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
  Object.assign(button.dataset, data); return button;
}
export function populateOptions(select, values, placeholder, selected) {
  if (selected && !values.includes(selected)) values.push(selected);
  select.replaceChildren(new Option(placeholder, ''), ...values.sort((a, b) => a.localeCompare(b)).map((value) => new Option(value, value)));
  select.value = selected;
}
export function makeLabel(label) {
  const button = element('button', 'tag', label.name);
  button.type = 'button'; button.style.setProperty('--tag-color', label.color);
  button.setAttribute('aria-label', `Rename label ${label.name}`); return button;
}
export function editLabel(button, name, save) {
  const input = element('input', 'inline-label-input');
  input.value = name; input.maxLength = 40; input.setAttribute('aria-label', 'Label name');
  button.replaceWith(input); input.focus(); input.select();
  let cancelled = false;
  input.addEventListener('keydown', (event) => {
    if (event.isComposing) return;
    if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelled = true; input.blur(); }
  });
  input.addEventListener('blur', () => {
    const value = input.value.trim(); input.replaceWith(button);
    if (!cancelled && value && value !== name) save(value);
  }, { once: true });
}
export function renderBoard(root, state, filters) {
  const columns = state.columns.filter((column) => !column.archived);
  const cards = visibleCards(state, filters);
  const filtering = Object.values(filters).some(Boolean);
  const nodes = [];
  if (!columns.length) {
    const empty = element('div', 'board-empty');
    empty.append(element('span', 'empty-glyph', '▥'), element('h2', '', 'No columns'), element('p', 'muted', 'Add a column above, or restore one from the archive.'));
    nodes.push(empty);
  }
  if (filtering && !cards.length) nodes.push(element('p', 'no-results', 'No cards match these filters. Clear filters to see your whole board.'));
  columns.forEach((column, index) => {
    const columnCards = cards.filter((card) => card.columnId === column.id);
    const section = element('section', `column${column.done ? ' completed-column' : ''}`);
    section.dataset.columnId = column.id; section.setAttribute('aria-label', column.name);
    const header = element('header', 'column-header'); header.draggable = true; header.dataset.columnDrag = column.id;
    header.title = 'Drag header to reorder column';
    const heading = element('h2'); heading.append(element('span', 'column-marker', column.done ? '✓' : '○'), document.createTextNode(column.name), element('span', 'count', columnCards.length));
    const controls = element('div', 'column-controls');
    const left = action('←', `Move ${column.name} column left`, { columnMove: '-1', id: column.id, focus: `column-left-${column.id}` }); left.disabled = index === 0;
    const right = action('→', `Move ${column.name} column right`, { columnMove: '1', id: column.id, focus: `column-right-${column.id}` }); right.disabled = index === columns.length - 1;
    controls.append(left, right, action('···', `Edit ${column.name} column`, { editColumn: column.id, focus: `column-edit-${column.id}` }));
    header.append(heading, controls);
    const list = element('div', 'card-list'); list.dataset.dropColumn = column.id;
    columnCards.forEach((card) => {
      const article = element('article', 'card'); article.dataset.cardId = card.id; article.draggable = true;
      const title = action(`${column.done ? '✓ ' : ''}${card.title}`, `Edit card: ${card.title}${column.done ? ' (complete)' : ''}`, { editCard: card.id, focus: `card-${card.id}` }); title.className = 'card-title';
      article.append(title);
      if (card.description) article.append(element('p', 'card-description', card.description));
      const tags = element('div', 'tags');
      card.labels.forEach((label, labelIndex) => { const tag = makeLabel(label); Object.assign(tag.dataset, { id: card.id, labelIndex }); tags.append(tag); });
      article.append(tags);
      const bottom = element('div', 'card-bottom');
      const assignee = element('span', 'assignee', card.assignee || 'Unassigned');
      const order = element('div', 'card-order');
      const allCards = visibleCards(state).filter((item) => item.columnId === column.id);
      const position = allCards.findIndex((item) => item.id === card.id);
      const up = action('↑', `Move ${card.title} up`, { cardOrder: '-1', id: card.id, focus: `card-up-${card.id}` }); up.disabled = position === 0;
      const down = action('↓', `Move ${card.title} down`, { cardOrder: '1', id: card.id, focus: `card-down-${card.id}` }); down.disabled = position === allCards.length - 1;
      order.append(up, down); bottom.append(assignee, order); article.append(bottom); list.append(article);
    });
    if (!columnCards.length) {
      const empty = element('div', 'column-empty'); empty.append(element('span', 'empty-glyph', column.done ? '✓' : '+'), element('p', '', filtering ? 'No matching cards' : column.done ? 'No completed cards' : 'No cards'), element('p', 'muted', 'Drop a card here or add one below.')); list.append(empty);
    }
    const add = action('+ Add card', `Add card to ${column.name}`, { addCard: column.id, focus: `add-${column.id}` }); add.className = 'add-card';
    section.append(header, list, add); nodes.push(section);
  });
  root.replaceChildren(...nodes);
}
export function renderArchive(root, state) {
  const archivedColumns = state.columns.filter((column) => column.archived);
  const cards = state.cards.filter((card) => card.archived || archivedColumns.some((column) => column.id === card.columnId));
  root.replaceChildren();
  function row(kind, id, title, detail) {
    const row = element('div', 'archive-row'); const copy = element('div');
    copy.append(element('strong', '', title), element('p', 'muted', detail));
    const restore = action('Restore', `Restore ${title}`, { restore: id, kind });
    row.append(copy, restore); root.append(row);
  }
  archivedColumns.forEach((column) => row('column', column.id, column.name, `Column: ${state.cards.filter((card) => card.columnId === column.id && !card.archived).length} cards return with it`));
  cards.forEach((card) => row('card', card.id, card.title, `Card: ${state.columns.find((column) => column.id === card.columnId)?.name || 'Archived column'}${!card.archived ? ' (column archived)' : ''}`));
  if (!archivedColumns.length && !cards.length) root.append(element('p', 'archive-empty', 'No archived cards or columns.'));
}
