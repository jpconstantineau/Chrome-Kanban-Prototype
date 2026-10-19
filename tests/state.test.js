import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, reducer, validateState, visibleCards } from '../docs/state.js';

const save = (state, title, columnId = 'column-todo', extra = {}) => reducer(state, {
  type: 'card.save', card: { title, columnId, ...extra },
});

test('starts with empty board, three columns and dark preference', () => {
  const state = createInitialState();
  assert.deepEqual(state.columns.map(column => column.name), ['To Do', 'In Progress', 'Done']);
  assert.deepEqual(state.cards, []);
  assert.equal(state.preferences.theme, 'dark');
  assert.equal(state.columns[2].done, true);
  assert.notEqual(createInitialState().columns, state.columns);
});

test('card save validates, clones labels and edits without mutating input', () => {
  const initial = createInitialState();
  const labels = [{ name: ' Build ', color: '#ABC' }];
  const state = save(initial, ' Ship ', undefined, { labels, assignee: ' Ada ' });
  assert.equal(initial.cards.length, 0);
  assert.equal(state.cards[0].title, 'Ship');
  assert.equal(state.cards[0].assignee, 'Ada');
  assert.deepEqual(state.cards[0].labels, [{ name: 'Build', color: '#abc' }]);
  labels[0].name = 'Changed outside reducer';
  assert.equal(state.cards[0].labels[0].name, 'Build');
  const edited = reducer(state, { type: 'card.save', card: { id: state.cards[0].id, description: 'Ready' } });
  assert.equal(state.cards[0].description, '');
  assert.equal(edited.cards[0].description, 'Ready');
  assert.equal(edited.cards[0].title, 'Ship');
});

test('reducer generates deterministic IDs without external state', () => {
  const state = createInitialState();
  assert.deepEqual(save(state, 'Task'), save(state, 'Task'));
  const next = save(save(state, 'One'), 'Two');
  assert.notEqual(next.cards[0].id, next.cards[1].id);
});

test('moves cards within and between columns and appends to destination', () => {
  let state = createInitialState();
  for (const title of ['One', 'Two', 'Three']) state = save(state, title);
  const [one, two, three] = state.cards;
  state = reducer(state, { type: 'card.move', id: three.id, columnId: 'column-todo', beforeId: one.id });
  assert.deepEqual(state.cards.map(card => card.title), ['Three', 'One', 'Two']);
  state = reducer(state, { type: 'card.move', id: one.id, columnId: 'column-progress' });
  assert.equal(state.cards.find(card => card.id === one.id).columnId, 'column-progress');
  state = reducer(state, { type: 'card.move', id: two.id, columnId: 'column-progress', beforeId: one.id });
  assert.deepEqual(state.cards.filter(card => card.columnId === 'column-progress').map(card => card.title), ['Two', 'One']);
  const same = reducer(state, { type: 'card.move', id: two.id, columnId: 'column-progress', beforeId: two.id });
  assert.deepEqual(same, state);
});

test('columns add, rename, reorder, archive and restore without losing cards', () => {
  let state = save(createInitialState(), 'Retained');
  state = reducer(state, { type: 'column.save', column: { name: 'Review' } });
  const review = state.columns.at(-1);
  state = reducer(state, { type: 'column.save', column: { id: review.id, name: 'Final review' } });
  state = reducer(state, { type: 'column.move', id: review.id, beforeId: 'column-todo' });
  assert.equal(state.columns[0].name, 'Final review');
  state = reducer(state, { type: 'column.archive', id: 'column-todo' });
  assert.equal(state.cards.length, 1);
  assert.equal(visibleCards(state).length, 0);
  state = reducer(state, { type: 'column.restore', id: 'column-todo' });
  assert.equal(visibleCards(state).length, 1);
});

test('card archive and restore preserves content and original active column', () => {
  let state = save(createInitialState(), 'Retained');
  const id = state.cards[0].id;
  state = reducer(state, { type: 'card.archive', id });
  assert.equal(visibleCards(state).length, 0);
  state = reducer(state, { type: 'card.restore', id });
  assert.equal(visibleCards(state)[0].title, 'Retained');
  assert.equal(state.cards[0].columnId, 'column-todo');
});

test('restoring a card from archived column uses explicit target or first active column', () => {
  let state = save(createInitialState(), 'Retained');
  const id = state.cards[0].id;
  state = reducer(state, { type: 'column.archive', id: 'column-todo' });
  const explicit = reducer(state, { type: 'card.restore', id, columnId: 'column-done' });
  assert.equal(explicit.cards[0].columnId, 'column-done');
  const fallback = reducer(state, { type: 'card.restore', id });
  assert.equal(fallback.cards[0].columnId, 'column-progress');
  assert.throws(() => reducer(state, { type: 'card.restore', id, columnId: 'column-todo' }), /active column/);
});

test('restoring a card creates a new To Do column when every column is archived', () => {
  let state = save(createInitialState(), 'Rescue me');
  for (const column of state.columns) state = reducer(state, { type: 'column.archive', id: column.id });
  state = reducer(state, { type: 'card.restore', id: state.cards[0].id });
  const active = state.columns.filter(column => !column.archived);
  assert.equal(active.length, 1);
  assert.equal(active[0].name, 'To Do');
  assert.equal(state.cards[0].columnId, active[0].id);
});

test('search and label and assignee combine, hide archived items, search description', () => {
  const labels = [{ name: 'Work', color: '#123456' }];
  let state = save(createInitialState(), 'Ship board', undefined, { description: 'Release today', labels, assignee: 'Ada' });
  state = save(state, 'Other', undefined, { labels, assignee: 'Lin' });
  state = save(state, 'Hidden', 'column-done', { description: 'Release today', labels, assignee: 'Ada' });
  state = reducer(state, { type: 'column.archive', id: 'column-done' });
  assert.deepEqual(visibleCards(state, { search: ' RELEASE ', label: 'Work', assignee: 'Ada' }).map(card => card.title), ['Ship board']);
  assert.equal(visibleCards(state, { search: 'Ship', label: 'Personal' }).length, 0);
  state = reducer(state, { type: 'card.archive', id: state.cards[0].id });
  assert.equal(visibleCards(state, { assignee: 'Ada' }).length, 0);
});

test('preferences and chat update immutably and validate values', () => {
  const initial = createInitialState();
  let state = reducer(initial, { type: 'preferences.update', preferences: { theme: 'light' } });
  state = reducer(state, { type: 'chat.append', message: { role: 'user', content: 'Hello' } });
  state = reducer(state, { type: 'chat.append', message: { role: 'assistant', content: 'Hi' } });
  assert.equal(initial.preferences.theme, 'dark');
  assert.equal(initial.chat.length, 0);
  assert.equal(state.chat.length, 2);
  assert.equal(reducer(state, { type: 'chat.clear' }).chat.length, 0);
  assert.throws(() => reducer(state, { type: 'preferences.update', preferences: { theme: 'pink' } }), /Theme/);
  assert.throws(() => reducer(state, { type: 'chat.append', message: { role: 'system', content: 'No' } }), /role/);
});

test('invalid user input and targets are rejected without altering state', () => {
  let state = createInitialState();
  for (const patch of [
    { title: '' }, { title: 'x'.repeat(161) }, { labels: [] },
    { labels: [{ name: '', color: '#ffffff' }] },
    { labels: [{ name: 'X', color: 'url(evil)' }] }, { assignee: 123 },
  ]) assert.throws(() => save(state, 'Task', undefined, patch));
  assert.equal(state.cards.length, 0);
  state = save(state, 'Task');
  assert.throws(() => reducer(state, { type: 'card.move', id: state.cards[0].id, columnId: 'missing' }), /Column/);
  state = reducer(state, { type: 'column.archive', id: 'column-todo' });
  assert.throws(() => save(state, 'Task'), /active column/);
  assert.throws(() => reducer(state, { type: 'column.save', column: { name: ' ' } }), /Column name/);
  assert.throws(() => reducer(state, { type: 'unknown' }), /Unknown action/);
});

test('stored state validation rejects incompatible and corrupt data', () => {
  const state = save(createInitialState(), 'Task');
  assert.equal(validateState(state), state);
  assert.throws(() => validateState({ ...state, version: 2 }), /version/);
  assert.throws(() => validateState({ ...state, columns: [...state.columns, state.columns[0]] }), /Duplicate/);
  assert.throws(() => validateState({ ...state, cards: [{ ...state.cards[0], columnId: 'gone' }] }), /missing column/);
});
