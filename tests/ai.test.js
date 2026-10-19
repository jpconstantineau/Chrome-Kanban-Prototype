import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardTools } from '../docs/ai.js';
import { createInitialState, reducer } from '../docs/state.js';

function board(options = {}) {
  let state = createInitialState();
  const calls = [];
  const confirmations = [];
  const notifications = [];
  const apply = action => { state = reducer(state, action); };
  const tools = createBoardTools({
    getState: () => state,
    dispatch: async action => {
      calls.push(action);
      if (options.failSave) throw new Error('Storage is full');
      apply(action);
    },
    confirmAction: async message => {
      confirmations.push(message);
      options.beforeConfirm?.(apply);
      return options.approve !== false;
    },
    notify: message => notifications.push(message),
  });
  return { get state() { return state; }, calls, confirmations, notifications, apply,
    tool: name => tools.find(tool => tool.name === name) };
}

test('read tool returns active data without asking or mutating', async () => {
  const fixture = board();
  fixture.apply({ type: 'card.save', card: { title: 'Visible', columnId: 'column-todo' } });
  fixture.apply({ type: 'card.save', card: { title: 'Hidden with column', columnId: 'column-done' } });
  fixture.apply({ type: 'column.archive', id: 'column-done' });
  const result = await fixture.tool('list_board').execute({});
  assert.deepEqual(result.cards.map(card => card.title), ['Visible']);
  assert.equal(result.columns.length, 2);
  assert.equal(result.totalCards, 1);
  assert.equal(result.truncated, false);
  assert.equal(fixture.confirmations.length, 0);
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.tool('list_board').annotations.readOnlyHint, true);
});

test('read tool caps model context and declares truncation', async () => {
  const fixture = board();
  for (let index = 0; index < 81; index++) fixture.apply({
    type: 'card.save', card: { title: `Task ${index}`, description: 'x'.repeat(300), columnId: 'column-todo' },
  });
  const result = await fixture.tool('list_board').execute({});
  assert.equal(result.cards.length, 80);
  assert.equal(result.cards[0].description.length, 160);
  assert.equal(result.totalCards, 81);
  assert.equal(result.truncated, true);
});

test('approved create and update retain omitted card fields', async () => {
  const fixture = board();
  const result = await fixture.tool('create_card').execute({
    title: 'Prepare release', description: 'Check all flows', assignee: 'Pat', columnId: 'column-todo',
    labels: [{ name: 'Release', color: '#245b91' }],
  });
  assert.equal(result.success, true);
  const card = fixture.state.cards[0];
  await fixture.tool('update_card').execute({ id: card.id, title: 'Ship release' });
  assert.equal(fixture.state.cards[0].title, 'Ship release');
  assert.equal(fixture.state.cards[0].description, 'Check all flows');
  assert.equal(fixture.state.cards[0].assignee, 'Pat');
  assert.deepEqual(fixture.state.cards[0].labels, [{ name: 'Release', color: '#245b91' }]);
  assert.equal(fixture.confirmations.length, 2);
  assert.match(fixture.confirmations[0], /Prepare release/);
});

test('invalid model arguments cannot reach confirmation or dispatch', async () => {
  const fixture = board();
  const invalid = [
    ['create_card', { title: ' ', columnId: 'column-todo' }],
    ['create_card', { title: 'A', columnId: 'missing' }],
    ['create_card', { title: 'A', columnId: 'column-todo', script: 'alert(1)' }],
    ['create_card', { title: 'A', columnId: 'column-todo', labels: [] }],
    ['create_card', { title: 'A', columnId: 'column-todo', labels: [{ name: 'X', color: 'url(evil)' }] }],
    ['create_card', { title: 'A', columnId: 'column-todo', labels: [{ name: 'X', color: '#123456', extra: true }] }],
    ['create_column', { name: 'x'.repeat(61) }],
    ['archive_card', { id: 'missing' }],
    ['list_board', { surprise: true }],
  ];
  for (const [name, args] of invalid) {
    assert.ok((await fixture.tool(name).execute(args)).error, `${name} rejects ${JSON.stringify(args)}`);
  }
  assert.equal(fixture.confirmations.length, 0);
  assert.equal(fixture.calls.length, 0);
});

test('empty updates and invalid card movement fail before confirmation', async () => {
  const fixture = board();
  fixture.apply({ type: 'card.save', card: { title: 'A', columnId: 'column-todo' } });
  fixture.apply({ type: 'card.save', card: { title: 'B', columnId: 'column-progress' } });
  const [first, second] = fixture.state.cards;
  assert.ok((await fixture.tool('update_card').execute({ id: first.id })).error);
  assert.ok((await fixture.tool('move_card').execute({ id: first.id, columnId: 'column-done', beforeId: second.id })).error);
  assert.ok((await fixture.tool('move_card').execute({ id: first.id, columnId: 'column-todo', beforeId: first.id })).error);
  assert.equal(fixture.confirmations.length, 0);
  assert.equal(fixture.calls.length, 0);
});

test('declined or aborted actions make no changes', async () => {
  const fixture = board({ approve: false });
  const result = await fixture.tool('create_column').execute({ name: 'Later' });
  assert.equal(result.cancelled, true);
  const controller = new AbortController();
  controller.abort();
  assert.ok((await fixture.tool('create_column').execute({ name: 'Later' }, { signal: controller.signal })).error);
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.notifications.length, 0);
  assert.equal(fixture.state.columns.length, 3);
});

test('action is revalidated when target changes during confirmation', async () => {
  const fixture = board({ beforeConfirm: apply => apply({ type: 'column.archive', id: 'column-todo' }) });
  const result = await fixture.tool('create_card').execute({ title: 'A', columnId: 'column-todo' });
  assert.match(result.error, /no longer exists/);
  assert.equal(fixture.calls.length, 0);
  assert.equal(fixture.state.cards.length, 0);
});

test('failed persistence does not report success or notify success', async () => {
  const fixture = board({ failSave: true });
  const result = await fixture.tool('create_card').execute({ title: 'A', columnId: 'column-todo' });
  assert.equal(result.error, 'Storage is full');
  assert.equal(result.success, undefined);
  assert.equal(fixture.notifications.length, 0);
  assert.equal(fixture.state.cards.length, 0);
});

test('moves and archive use validated shared board actions', async () => {
  const fixture = board();
  fixture.apply({ type: 'card.save', card: { title: 'A', columnId: 'column-todo' } });
  const id = fixture.state.cards[0].id;
  assert.equal((await fixture.tool('move_card').execute({ id, columnId: 'column-done' })).success, true);
  assert.equal(fixture.state.cards[0].columnId, 'column-done');
  assert.equal((await fixture.tool('archive_card').execute({ id })).success, true);
  assert.equal(fixture.state.cards[0].archived, true);
  assert.ok((await fixture.tool('update_card').execute({ id, title: 'Edited' })).error);
});
