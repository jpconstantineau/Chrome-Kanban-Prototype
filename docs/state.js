const DEFAULT_LABEL = { name: 'Task', color: '#38bdf8' };

export function uid() {
  return globalThis.crypto.randomUUID();
}

export function createInitialState() {
  return {
    version: 1,
    columns: [
      { id: 'column-todo', name: 'To Do', done: false, archived: false },
      { id: 'column-progress', name: 'In Progress', done: false, archived: false },
      { id: 'column-done', name: 'Done', done: true, archived: false },
    ],
    cards: [],
    preferences: { theme: 'dark' },
    chat: [],
  };
}

function text(value, name, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error(`${name} must be ${required ? 'nonempty ' : ''}text up to ${max} characters.`);
  }
  return required ? value.trim() : value;
}

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
}

function boolean(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} must be true or false.`);
}

function validateColumn(column) {
  record(column, 'Column');
  text(column.id, 'Column ID', 100, true);
  text(column.name, 'Column name', 60, true);
  boolean(column.done, 'Completion column');
  boolean(column.archived, 'Column archive status');
}

function validateCard(card) {
  record(card, 'Card');
  text(card.id, 'Card ID', 100, true);
  text(card.columnId, 'Column ID', 100, true);
  text(card.title, 'Card title', 160, true);
  text(card.description, 'Description', 5000);
  text(card.assignee, 'Assignee', 80);
  boolean(card.archived, 'Card archive status');
  if (!Array.isArray(card.labels) || card.labels.length < 1 || card.labels.length > 10) {
    throw new Error('A card needs between 1 and 10 labels.');
  }
  for (const label of card.labels) {
    record(label, 'Label');
    text(label.name, 'Label name', 40, true);
    if (typeof label.color !== 'string' || !/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(label.color)) {
      throw new Error('Label color must be a hex color, such as #38bdf8.');
    }
  }
}

function validateMessage(message) {
  record(message, 'Chat message');
  if (!['user', 'assistant'].includes(message.role)) throw new Error('Invalid chat message role.');
  text(message.content, 'Chat message', 30000, true);
}

export function validateState(state) {
  record(state, 'Board');
  if (state.version !== 1) throw new Error('Unsupported board data version.');
  if (!Array.isArray(state.columns) || !Array.isArray(state.cards) || !Array.isArray(state.chat)) {
    throw new Error('Board columns, cards and chat must be lists.');
  }
  const columnIds = new Set();
  for (const column of state.columns) {
    validateColumn(column);
    if (columnIds.has(column.id)) throw new Error('Duplicate column ID.');
    columnIds.add(column.id);
  }
  const cardIds = new Set();
  for (const card of state.cards) {
    validateCard(card);
    if (cardIds.has(card.id)) throw new Error('Duplicate card ID.');
    if (!columnIds.has(card.columnId)) throw new Error('Card references a missing column.');
    cardIds.add(card.id);
  }
  record(state.preferences, 'Preferences');
  if (!['dark', 'light'].includes(state.preferences.theme)) throw new Error('Theme must be dark or light.');
  state.chat.forEach(validateMessage);
  return state;
}

function nextId(items, prefix) {
  let number = 1;
  while (items.some(item => item.id === `${prefix}-${number}`)) number += 1;
  return `${prefix}-${number}`;
}

function find(items, id, name) {
  const item = items.find(entry => entry.id === id);
  if (!item) throw new Error(`${name} no longer exists.`);
  return item;
}

function activeColumn(state, id) {
  const column = find(state.columns, id, 'Column');
  if (column.archived) throw new Error('Choose an active column.');
  return column;
}

function reorder(items, item, beforeId) {
  if (beforeId === item.id) return items;
  const rest = items.filter(entry => entry.id !== item.id);
  const index = beforeId == null ? rest.length : rest.findIndex(entry => entry.id === beforeId);
  if (index < 0) throw new Error('The destination item no longer exists.');
  return [...rest.slice(0, index), item, ...rest.slice(index)];
}

export function reducer(state, action) {
  record(action, 'Action');
  let result;
  switch (action.type) {
    case 'card.save': {
      record(action.card, 'Card');
      const patch = action.card;
      const old = patch.id ? state.cards.find(card => card.id === patch.id) : null;
      if (old?.archived) throw new Error('Restore the archived card before editing.');
      const card = {
        id: patch.id ?? nextId(state.cards, 'card'),
        columnId: patch.columnId ?? old?.columnId,
        title: patch.title ?? old?.title ?? '',
        description: patch.description ?? old?.description ?? '',
        labels: (patch.labels ?? old?.labels ?? [DEFAULT_LABEL]).map(label => ({ ...label })),
        assignee: patch.assignee ?? old?.assignee ?? '',
        archived: false,
      };
      activeColumn(state, card.columnId);
      validateCard(card);
      card.title = card.title.trim();
      card.assignee = card.assignee.trim();
      card.labels = card.labels.map(label => ({ name: label.name.trim(), color: label.color.toLowerCase() }));
      result = { ...state, cards: old ? state.cards.map(entry => entry.id === card.id ? card : entry) : [...state.cards, card] };
      break;
    }
    case 'card.archive': {
      find(state.cards, action.id, 'Card');
      result = { ...state, cards: state.cards.map(card => card.id === action.id ? { ...card, archived: true } : card) };
      break;
    }
    case 'card.restore': {
      const card = find(state.cards, action.id, 'Card');
      let columns = state.columns;
      let column = action.columnId ? activeColumn(state, action.columnId) : columns.find(entry => entry.id === card.columnId && !entry.archived);
      column ??= columns.find(entry => !entry.archived);
      if (!column) {
        column = { id: nextId(columns, 'column'), name: 'To Do', done: false, archived: false };
        columns = [...columns, column];
      }
      result = { ...state, columns, cards: state.cards.map(entry => entry.id === card.id ? { ...entry, archived: false, columnId: column.id } : entry) };
      break;
    }
    case 'card.move': {
      const card = find(state.cards, action.id, 'Card');
      if (card.archived) throw new Error('Restore the archived card before moving.');
      activeColumn(state, card.columnId);
      activeColumn(state, action.columnId);
      if (action.beforeId != null) {
        const before = find(state.cards, action.beforeId, 'Destination card');
        if (before.columnId !== action.columnId || before.archived) throw new Error('Destination card must be active and in the target column.');
      }
      result = { ...state, cards: reorder(state.cards, { ...card, columnId: action.columnId }, action.beforeId) };
      break;
    }
    case 'column.save': {
      record(action.column, 'Column');
      const patch = action.column;
      const old = patch.id ? state.columns.find(column => column.id === patch.id) : null;
      if (old?.archived) throw new Error('Restore the archived column before editing.');
      const name = text(patch.name ?? old?.name ?? '', 'Column name', 60, true);
      const column = { id: patch.id ?? nextId(state.columns, 'column'), name, done: patch.done ?? old?.done ?? name.toLowerCase() === 'done', archived: false };
      validateColumn(column);
      result = { ...state, columns: old ? state.columns.map(entry => entry.id === column.id ? column : entry) : [...state.columns, column] };
      break;
    }
    case 'column.move': {
      const column = activeColumn(state, action.id);
      if (action.beforeId != null) activeColumn(state, action.beforeId);
      result = { ...state, columns: reorder(state.columns, column, action.beforeId) };
      break;
    }
    case 'column.archive':
    case 'column.restore': {
      find(state.columns, action.id, 'Column');
      result = { ...state, columns: state.columns.map(column => column.id === action.id ? { ...column, archived: action.type === 'column.archive' } : column) };
      break;
    }
    case 'preferences.update': {
      record(action.preferences, 'Preferences');
      result = { ...state, preferences: { theme: action.preferences.theme ?? state.preferences.theme } };
      break;
    }
    case 'chat.append': {
      validateMessage(action.message);
      result = { ...state, chat: [...state.chat, { role: action.message.role, content: action.message.content.trim() }] };
      break;
    }
    case 'chat.clear':
      result = { ...state, chat: [] };
      break;
    default:
      throw new Error(`Unknown action: ${action.type}`);
  }
  return validateState(result);
}

export function visibleCards(state, { search = '', label = '', assignee = '' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  const active = new Set(state.columns.filter(column => !column.archived).map(column => column.id));
  return state.cards.filter(card => !card.archived && active.has(card.columnId)
    && (!query || `${card.title}\n${card.description}`.toLocaleLowerCase().includes(query))
    && (!label || card.labels.some(entry => entry.name === label))
    && (!assignee || card.assignee === assignee));
}
