const STORAGE_KEY = 'glass_todo_v1';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const els = {
  form: $('#taskForm'),
  input: $('#taskInput'),
  addBtn: $('#addBtn'),
  deleteAllBtn: $('#deleteAllBtn'),

  darkToggle: $('#darkModeToggle'),

  filters: $$('.pill'),
  lists: {
    pending: $('#pendingList'),
    completed: $('#completedList'),
  },
  empty: {
    pending: $('[data-empty-for="pending"]'),
    completed: $('[data-empty-for="completed"]'),
  },
  counterText: $('#counterText'),

  template: $('#taskTemplate'),
};

const state = {
  tasks: [],
  filter: 'all',
  editingId: null,
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function loadTheme() {
  const theme = localStorage.getItem('glass_todo_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme ? theme === 'dark' : prefersDark;

  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  els.darkToggle.checked = isDark;
}

function setTheme(isDark) {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('glass_todo_theme', isDark ? 'dark' : 'light');
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.tasks = raw ? JSON.parse(raw) : [];
  } catch {
    state.tasks = [];
  }
}

function normalizeTasks() {
  // Ensure shape for old data.
  state.tasks = state.tasks.map((t) => ({
    id: String(t.id ?? uid()),
    title: String(t.title ?? '').trim(),
    completed: Boolean(t.completed),
  })).filter((t) => t.title.length > 0);
}

function getFilteredTasks() {
  if (state.filter === 'active') return state.tasks.filter((t) => !t.completed);
  if (state.filter === 'completed') return state.tasks.filter((t) => t.completed);
  return state.tasks;
}

function renderEmptyStates() {
  const pendingCount = state.tasks.filter((t) => !t.completed).length;
  const completedCount = state.tasks.filter((t) => t.completed).length;
  els.empty.pending.style.display = pendingCount === 0 ? 'block' : 'none';
  els.empty.completed.style.display = completedCount === 0 ? 'block' : 'none';
}

function renderCounters() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  els.counterText.textContent = `Total: ${total} • Completed: ${completed} • Pending: ${pending}`;
}

function clearLists() {
  els.lists.pending.innerHTML = '';
  els.lists.completed.innerHTML = '';
}

function createTaskElement(task) {
  const li = els.template.content.firstElementChild.cloneNode(true);
  li.dataset.taskId = task.id;

  const titleSpan = $('.task-title', li);
  const titleInput = $('[data-edit-input]', li);
  const checkBtn = $('[data-check]', li);

  titleSpan.textContent = task.title;
  titleInput.value = task.title;

  li.classList.toggle('is-completed', task.completed);
  checkBtn.setAttribute('aria-pressed', String(task.completed));

  // Toggle completed
  checkBtn.addEventListener('click', () => {
    setTaskCompleted(task.id, !task.completed);
  });

  // Delete
  const delBtn = $('[data-delete]', li);
  delBtn.addEventListener('click', () => {
    removeTask(task.id, li);
  });

  // Edit
  const editBtn = $('[data-edit]', li);
  editBtn.addEventListener('click', () => startEditing(task.id, li));

  // Edit input interactions
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      finishEditing(task.id, li);
    } else if (e.key === 'Escape') {
      cancelEditing(task.id, li);
    }
  });

  titleInput.addEventListener('blur', () => finishEditing(task.id, li, { allowEmpty: false }));

  return li;
}

function updateFilterPills() {
  els.filters.forEach((b) => {
    const active = b.dataset.filter === state.filter;
    b.classList.toggle('is-active', active);
  });
}

function applyFilterAndRender() {
  updateFilterPills();
  clearLists();

  const filtered = getFilteredTasks();
  // Still show tasks in their correct sections.
  const pending = filtered.filter((t) => !t.completed);
  const completed = filtered.filter((t) => t.completed);

  for (const t of pending) els.lists.pending.appendChild(createTaskElement(t));
  for (const t of completed) els.lists.completed.appendChild(createTaskElement(t));

  renderEmptyStates();
  renderCounters();
}

function setTaskCompleted(id, completed) {
  state.tasks = state.tasks.map((t) => (t.id === id ? { ...t, completed } : t));
  persist();
  applyFilterAndRender();
}

function removeTask(id, liEl) {
  // Animation: mark removing, then remove.
  liEl.dataset.removing = 'true';
  setTimeout(() => {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    persist();
    applyFilterAndRender();
  }, 170);
}

function startEditing(id, liEl) {
  if (state.editingId && state.editingId !== id) {
    const prev = document.querySelector(`[data-task-id="${state.editingId}"]`);
    if (prev) cancelEditing(state.editingId, prev);
  }

  state.editingId = id;
  liEl.classList.add('is-editing');

  const titleSpan = $('.task-title', liEl);
  const titleInput = $('[data-edit-input]', liEl);
  const editBtn = $('[data-edit]', liEl);
  const checkBtn = $('[data-check]', liEl);

  titleSpan.hidden = true;
  titleInput.hidden = false;
  titleInput.focus();
  titleInput.select();

  // Prevent accidental toggle while editing
  checkBtn.disabled = true;
  editBtn.disabled = true;
  editBtn.style.opacity = '0.65';
}

function cancelEditing(id, liEl) {
  const titleSpan = $('.task-title', liEl);
  const titleInput = $('[data-edit-input]', liEl);
  const editBtn = $('[data-edit]', liEl);
  const checkBtn = $('[data-check]', liEl);

  const task = state.tasks.find((t) => t.id === id);
  titleInput.value = task ? task.title : '';

  titleInput.hidden = true;
  titleSpan.hidden = false;

  checkBtn.disabled = false;
  editBtn.disabled = false;
  editBtn.style.opacity = '';

  liEl.classList.remove('is-editing');
  if (state.editingId === id) state.editingId = null;
}

function finishEditing(id, liEl, { allowEmpty = false } = {}) {
  const titleSpan = $('.task-title', liEl);
  const titleInput = $('[data-edit-input]', liEl);
  const editBtn = $('[data-edit]', liEl);
  const checkBtn = $('[data-check]', liEl);

  const raw = titleInput.value.trim();
  const task = state.tasks.find((t) => t.id === id);
  const currentTitle = task ? task.title : '';

  if (!allowEmpty && raw.length === 0) {
    titleInput.value = currentTitle;
    cancelEditing(id, liEl);
    return;
  }

  titleSpan.hidden = false;
  titleInput.hidden = true;

  checkBtn.disabled = false;
  editBtn.disabled = false;
  editBtn.style.opacity = '';

  liEl.classList.remove('is-editing');
  if (state.editingId === id) state.editingId = null;

  if (raw === currentTitle) return;

  state.tasks = state.tasks.map((t) => (t.id === id ? { ...t, title: raw } : t));
  persist();
  applyFilterAndRender();
}

function addTask(title) {
  const trimmed = title.trim();
  if (!trimmed) return;

  const task = {
    id: uid(),
    title: trimmed,
    completed: false,
  };

  state.tasks = [task, ...state.tasks];
  persist();
  applyFilterAndRender();
}

function deleteAll() {
  const hasAny = state.tasks.length > 0;
  if (!hasAny) return;

  // Confirm, but keep it simple.
  const ok = window.confirm('Delete all tasks?');
  if (!ok) return;

  // quick animation: remove all and re-render after.
  els.lists.pending.querySelectorAll('[data-task]').forEach((li) => (li.dataset.removing = 'true'));
  els.lists.completed.querySelectorAll('[data-task]').forEach((li) => (li.dataset.removing = 'true'));

  setTimeout(() => {
    state.tasks = [];
    persist();
    applyFilterAndRender();
  }, 180);
}

function init() {
  loadTheme();
  load();
  normalizeTasks();

  // Filter clicks
  els.filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      applyFilterAndRender();
    });
  });

  // Dark mode toggle
  els.darkToggle.addEventListener('change', () => setTheme(els.darkToggle.checked));

  // Add submit
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = els.input.value;
    els.input.value = '';
    addTask(val);
    els.input.focus();
  });

  // Delete all
  els.deleteAllBtn.addEventListener('click', deleteAll);

  applyFilterAndRender();
}

init();

