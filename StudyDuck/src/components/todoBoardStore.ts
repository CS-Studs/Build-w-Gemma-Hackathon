export type TodoItem = { id: string; text: string; completed: boolean };
export type TodoList = { id: string; title: string; items: TodoItem[]; collapsed?: boolean };
export type TodoProject = { id: string; title: string; collapsed: boolean; lists: TodoList[] };
export type TodoBoardV2 = { version: 2; ungroupedCollapsed: boolean; ungroupedLists: TodoList[]; projects: TodoProject[] };

export type TodoCreationProposal = {
  projects: { ref: string; title: string }[];
  lists: { ref: string; title: string; destination: "ungrouped" | "existing_project" | "new_project"; projectId?: string; projectRef?: string }[];
  tasks: { text: string; destination: "existing_list" | "new_list"; listId?: string; listRef?: string }[];
};

export const TODO_BOARD_STORAGE_KEY = "studyduck.todo-board.v2";
export const TODO_BOARD_CHANGED_EVENT = "studyduck:todo-board-changed";
const LEGACY_STORAGE_KEY = "studyduck.todo-lists.v1";
const makeId = () => crypto.randomUUID();

function isItem(value: unknown): value is TodoItem { const item = value as TodoItem; return !!item && typeof item.id === "string" && typeof item.text === "string" && typeof item.completed === "boolean"; }
function isList(value: unknown): value is TodoList { const list = value as TodoList; return !!list && typeof list.id === "string" && typeof list.title === "string" && (list.collapsed === undefined || typeof list.collapsed === "boolean") && Array.isArray(list.items) && list.items.every(isItem); }
function isBoard(value: unknown): value is TodoBoardV2 { const board = value as TodoBoardV2; return !!board && board.version === 2 && typeof board.ungroupedCollapsed === "boolean" && Array.isArray(board.ungroupedLists) && board.ungroupedLists.every(isList) && Array.isArray(board.projects) && board.projects.every((project) => !!project && typeof project.id === "string" && typeof project.title === "string" && typeof project.collapsed === "boolean" && Array.isArray(project.lists) && project.lists.every(isList)); }

export function loadTodoBoard(): TodoBoardV2 {
  try {
    const stored = localStorage.getItem(TODO_BOARD_STORAGE_KEY);
    if (stored) { const parsed: unknown = JSON.parse(stored); if (isBoard(parsed)) return parsed; }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) { const parsed: unknown = JSON.parse(legacy); if (Array.isArray(parsed) && parsed.every(isList)) return { version: 2, ungroupedCollapsed: false, ungroupedLists: parsed, projects: [] }; }
  } catch { /* Fall through. */ }
  return { version: 2, ungroupedCollapsed: false, ungroupedLists: [{ id: makeId(), title: "My tasks", items: [], collapsed: false }], projects: [] };
}

export function saveTodoBoard(board: TodoBoardV2, source: "todo-ui" | "duckchat"): boolean {
  let persisted = true;
  try { localStorage.setItem(TODO_BOARD_STORAGE_KEY, JSON.stringify(board)); } catch { persisted = false; }
  if (persisted) window.dispatchEvent(new CustomEvent(TODO_BOARD_CHANGED_EVENT, { detail: { board, source } }));
  return persisted;
}

export function getTodoStructure() {
  const board = loadTodoBoard();
  return {
    projects: board.projects.map((project) => ({ id: project.id, title: project.title, lists: project.lists.map((list) => ({ id: list.id, title: list.title })) })),
    ungroupedLists: board.ungroupedLists.map((list) => ({ id: list.id, title: list.title })),
  };
}

const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
export function validateTodoProposal(value: unknown): { ok: true; proposal: TodoCreationProposal } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "The proposal must be an object." };
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.projects) || !Array.isArray(raw.lists) || !Array.isArray(raw.tasks)) return { ok: false, error: "Projects, lists, and tasks arrays are required." };
  const projects = raw.projects.map((entry) => ({ ref: text((entry as any)?.ref, 60), title: text((entry as any)?.title, 60) }));
  const lists = raw.lists.map((entry) => ({ ref: text((entry as any)?.ref, 60), title: text((entry as any)?.title, 60), destination: (entry as any)?.destination, projectId: text((entry as any)?.projectId, 80) || undefined, projectRef: text((entry as any)?.projectRef, 60) || undefined })) as TodoCreationProposal["lists"];
  const tasks = raw.tasks.map((entry) => ({ text: text((entry as any)?.text, 160), destination: (entry as any)?.destination, listId: text((entry as any)?.listId, 80) || undefined, listRef: text((entry as any)?.listRef, 60) || undefined })) as TodoCreationProposal["tasks"];
  if (!projects.length && !lists.length && !tasks.length) return { ok: false, error: "The proposal is empty." };
  if (projects.some((p) => !p.ref || !p.title) || lists.some((l) => !l.ref || !l.title) || tasks.some((t) => !t.text)) return { ok: false, error: "Every proposed entity needs a non-empty reference and title or task text." };
  const projectRefs = new Set(projects.map((p) => p.ref)); const listRefs = new Set(lists.map((l) => l.ref));
  if (projectRefs.size !== projects.length || listRefs.size !== lists.length) return { ok: false, error: "Temporary references must be unique." };
  const board = loadTodoBoard();
  for (const list of lists) {
    if (!["ungrouped", "existing_project", "new_project"].includes(list.destination)) return { ok: false, error: `List ${list.title} has an invalid destination.` };
    if (list.destination === "existing_project" && !board.projects.some((p) => p.id === list.projectId)) return { ok: false, error: `The destination project for ${list.title} does not exist. Ask the user which project to use.` };
    if (list.destination === "new_project" && (!list.projectRef || !projectRefs.has(list.projectRef))) return { ok: false, error: `The proposed parent project for ${list.title} is missing.` };
  }
  const existingLists = [...board.ungroupedLists, ...board.projects.flatMap((p) => p.lists)];
  for (const task of tasks) {
    if (task.destination === "existing_list" && !existingLists.some((l) => l.id === task.listId)) return { ok: false, error: `The task destination does not exist. Ask the user to choose a list.` };
    if (task.destination === "new_list" && (!task.listRef || !listRefs.has(task.listRef))) return { ok: false, error: `The proposed list for task “${task.text}” is missing.` };
    if (!task.listId && !task.listRef) return { ok: false, error: `Task “${task.text}” has no list. Ask the user which list to use.` };
  }
  return { ok: true, proposal: { projects, lists, tasks } };
}

export function applyTodoProposal(proposal: TodoCreationProposal): { ok: true; created: { projects: string[]; lists: string[]; tasks: string[] } } | { ok: false; error: string } {
  const checked = validateTodoProposal(proposal); if (!checked.ok) return checked;
  let board = loadTodoBoard();
  const projectIds = new Map<string, string>(); const listIds = new Map<string, string>();
  const created = { projects: [] as string[], lists: [] as string[], tasks: [] as string[] };
  for (const project of proposal.projects) { const id = makeId(); projectIds.set(project.ref, id); created.projects.push(project.title); board = { ...board, projects: [...board.projects, { id, title: project.title, collapsed: false, lists: [] }] }; }
  for (const list of proposal.lists) {
    const id = makeId(); listIds.set(list.ref, id); created.lists.push(list.title); const next: TodoList = { id, title: list.title, items: [], collapsed: false };
    if (list.destination === "ungrouped") board = { ...board, ungroupedLists: [...board.ungroupedLists, next] };
    else { const projectId = list.destination === "existing_project" ? list.projectId : projectIds.get(list.projectRef ?? ""); if (!projectId) return { ok: false, error: `Project for ${list.title} became unavailable.` }; board = { ...board, projects: board.projects.map((p) => p.id === projectId ? { ...p, lists: [...p.lists, next] } : p) }; }
  }
  for (const task of proposal.tasks) {
    const listId = task.destination === "existing_list" ? task.listId : listIds.get(task.listRef ?? ""); if (!listId) return { ok: false, error: `List for ${task.text} became unavailable.` };
    let found = false; const item = { id: makeId(), text: task.text, completed: false }; created.tasks.push(task.text);
    const map = (list: TodoList) => list.id === listId ? (found = true, { ...list, items: [...list.items, item] }) : list;
    board = { ...board, ungroupedLists: board.ungroupedLists.map(map), projects: board.projects.map((p) => ({ ...p, lists: p.lists.map(map) })) };
    if (!found) return { ok: false, error: `List for ${task.text} became unavailable.` };
  }
  if (!saveTodoBoard(board, "duckchat")) return { ok: false, error: "The board could not be saved." };
  return { ok: true, created };
}
