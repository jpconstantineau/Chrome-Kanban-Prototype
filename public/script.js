document.addEventListener("DOMContentLoaded", () => {
  const taskForm = document.getElementById("task-form");
  const taskInput = document.getElementById("task-input");
  const todoList = document.getElementById("todo-list");
  const doingList = document.getElementById("doing-list");
  const doneList = document.getElementById("done-list");

  if (!taskForm || !taskInput || !todoList || !doingList || !doneList) {
    return;
  }

  const columns = [todoList, doingList, doneList];

  function createMoveButton(label, direction, ariaLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.className = "move-button";
    button.dataset.direction = direction;
    button.setAttribute("aria-label", ariaLabel);
    return button;
  }

  function createTaskItem(value, columnIndex = 0) {
    const listItem = document.createElement("li");
    const label = document.createElement("span");
    const actions = document.createElement("div");

    label.textContent = value;
    actions.className = "task-actions";
    listItem.append(label, actions);

    const moveLeft = createMoveButton("←", "left", "Move task left");
    const moveRight = createMoveButton("→", "right", "Move task right");

    actions.append(moveLeft, moveRight);
    updateMoveButtons(listItem, columnIndex);
    return listItem;
  }

  function updateMoveButtons(listItem, columnIndex) {
    const leftButton = listItem.querySelector('button[data-direction="left"]');
    const rightButton = listItem.querySelector('button[data-direction="right"]');
    const taskLabel = listItem.querySelector("span")?.textContent || "task";

    leftButton.onclick = () => moveTask(listItem, columnIndex - 1);
    rightButton.onclick = () => moveTask(listItem, columnIndex + 1);
    leftButton.setAttribute("aria-label", `Move ${taskLabel} left`);
    rightButton.setAttribute("aria-label", `Move ${taskLabel} right`);
    leftButton.disabled = columnIndex === 0;
    rightButton.disabled = columnIndex === columns.length - 1;
  }

  function moveTask(listItem, targetIndex) {
    if (targetIndex < 0 || targetIndex >= columns.length) {
      return;
    }

    columns[targetIndex].appendChild(listItem);
    updateMoveButtons(listItem, targetIndex);
  }

  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = taskInput.value.trim();
    if (!value) {
      return;
    }

    const listItem = createTaskItem(value);
    todoList.appendChild(listItem);
    taskInput.value = "";
  });
});
