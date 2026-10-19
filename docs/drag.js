export function setupDragAndDrop(board, dispatch) {
  let dragged = null;
  const clear = () => board.querySelectorAll('.drop-before, .drop-after, .drop-target, .dragging').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-target', 'dragging'));
  board.addEventListener('dragstart', (event) => {
    if (event.target.closest('input, textarea, select') || event.target.closest('button') && !event.target.closest('.card-title')) { event.preventDefault(); return; }
    const card = event.target.closest('[data-card-id]');
    const header = event.target.closest('[data-column-drag]');
    if (!card && !header) return;
    dragged = { kind: card ? 'card' : 'column', id: card?.dataset.cardId || header.dataset.columnDrag };
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', dragged.id);
    (card || header).classList.add('dragging');
  });
  function targetAt(event) {
    if (!dragged) return null;
    const column = event.target.closest('[data-column-id]');
    if (!column) return null;
    if (dragged.kind === 'column') {
      if (column.dataset.columnId === dragged.id) return null;
      const rect = column.getBoundingClientRect();
      const after = event.clientX > rect.left + rect.width / 2;
      return { el: column, after, action: { type: 'column.move', id: dragged.id, beforeId: after ? column.nextElementSibling?.dataset.columnId : column.dataset.columnId } };
    }
    const card = event.target.closest('[data-card-id]');
    if (card?.dataset.cardId === dragged.id) return null;
    const after = card && event.clientY > card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2;
    return { el: card || column.querySelector('.card-list'), after, action: { type: 'card.move', id: dragged.id, columnId: column.dataset.columnId, beforeId: card ? after ? card.nextElementSibling?.dataset.cardId : card.dataset.cardId : undefined } };
  }
  board.addEventListener('dragover', (event) => {
    const target = targetAt(event); clear(); if (!target) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    target.el.classList.add(target.el.classList.contains('card-list') ? 'drop-target' : target.after ? 'drop-after' : 'drop-before');
  });
  board.addEventListener('drop', (event) => {
    const target = targetAt(event); if (target) { event.preventDefault(); dispatch(target.action); }
    clear(); dragged = null;
  });
  board.addEventListener('dragend', () => { clear(); dragged = null; });
}
