const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const todoList = document.getElementById("todo-list");

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = taskInput.value.trim();
  if (!value) {
    return;
  }

  const listItem = document.createElement("li");
  listItem.textContent = value;
  todoList.appendChild(listItem);
  taskInput.value = "";
});
