import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./ToDoList.css";

type TodoItem = { id: string; text: string; completed: boolean };
type TodoList = { id: string; title: string; items: TodoItem[]; collapsed?: boolean };
type TodoProject = { id: string; title: string; collapsed: boolean; lists: TodoList[] };
type TodoBoardV2 = {
  version: 2;
  ungroupedCollapsed: boolean;
  ungroupedLists: TodoList[];
  projects: TodoProject[];
};
type ContainerId = "ungrouped" | string;
type DragState =
  | { type: "project"; projectId: string }
  | { type: "list"; listId: string; containerId: ContainerId }
  | { type: "item"; listId: string; itemId: string };
type PointerDragState = DragState & { label: string; width: number };

const STORAGE_KEY = "studyduck.todo-board.v2";
const LEGACY_STORAGE_KEY = "studyduck.todo-lists.v1";
const EXPAND_DELAY = 550;

const makeId = () => crypto.randomUUID();

function isItem(value: unknown): value is TodoItem {
  const item = value as TodoItem;
  return !!item && typeof item.id === "string" && typeof item.text === "string" && typeof item.completed === "boolean";
}

function isList(value: unknown): value is TodoList {
  const list = value as TodoList;
  return !!list && typeof list.id === "string" && typeof list.title === "string" &&
    (list.collapsed === undefined || typeof list.collapsed === "boolean") &&
    Array.isArray(list.items) && list.items.every(isItem);
}

function isBoard(value: unknown): value is TodoBoardV2 {
  const board = value as TodoBoardV2;
  return !!board && board.version === 2 && typeof board.ungroupedCollapsed === "boolean" &&
    Array.isArray(board.ungroupedLists) && board.ungroupedLists.every(isList) &&
    Array.isArray(board.projects) && board.projects.every((project: unknown) => {
      const candidate = project as TodoProject;
      return !!candidate && typeof candidate.id === "string" && typeof candidate.title === "string" &&
        typeof candidate.collapsed === "boolean" && Array.isArray(candidate.lists) && candidate.lists.every(isList);
    });
}

function loadBoard(): TodoBoardV2 {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isBoard(parsed)) return parsed;
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed: unknown = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.every(isList)) {
        return { version: 2, ungroupedCollapsed: false, ungroupedLists: parsed, projects: [] };
      }
    }
  } catch { /* Storage is optional. */ }
  return {
    version: 2,
    ungroupedCollapsed: false,
    ungroupedLists: [{ id: makeId(), title: "My tasks", items: [], collapsed: false }],
    projects: [],
  };
}

function allLists(board: TodoBoardV2) {
  return [...board.ungroupedLists, ...board.projects.flatMap((project) => project.lists)];
}

function listsIn(board: TodoBoardV2, containerId: ContainerId) {
  return containerId === "ungrouped"
    ? board.ungroupedLists
    : board.projects.find((project) => project.id === containerId)?.lists;
}

function updateListsIn(board: TodoBoardV2, containerId: ContainerId, lists: TodoList[]): TodoBoardV2 {
  return containerId === "ungrouped"
    ? { ...board, ungroupedLists: lists }
    : { ...board, projects: board.projects.map((project) => project.id === containerId ? { ...project, lists } : project) };
}

function mapLists(board: TodoBoardV2, callback: (list: TodoList) => TodoList): TodoBoardV2 {
  return {
    ...board,
    ungroupedLists: board.ungroupedLists.map(callback),
    projects: board.projects.map((project) => ({ ...project, lists: project.lists.map(callback) })),
  };
}

function GripIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="5" cy="4" r="1"/><circle cx="11" cy="4" r="1"/><circle cx="5" cy="8" r="1"/><circle cx="11" cy="8" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="11" cy="12" r="1"/></svg>;
}
function CollapseIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>; }
function PlusIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>; }
function TrashIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6 4V2.75h4V4m2 0-.65 9H4.65L4 4m2.5 2v4.5m3-4.5v4.5"/></svg>; }

/** A locally persisted hierarchy of draggable projects, lists, and tasks. */
export function ToDoList() {
  const [board, setBoard] = useState<TodoBoardV2>(loadBoard);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [newEntity, setNewEntity] = useState<{ type: "list" | "project"; containerId?: ContainerId } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [editing, setEditing] = useState<{ type: "list" | "project"; id: string } | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [dragging, setDragging] = useState<PointerDragState | null>(null);
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });
  const entityInput = useRef<HTMLInputElement>(null);
  const itemInput = useRef<HTMLInputElement>(null);
  const itemForm = useRef<HTMLFormElement>(null);
  const createMenu = useRef<HTMLDivElement>(null);
  const expandTimer = useRef<number | null>(null);
  const expandTarget = useRef<string | null>(null);

  const lists = useMemo(() => allLists(board), [board]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(board)); } catch { /* Keep session state. */ }
  }, [board]);
  useEffect(() => { if (newEntity) entityInput.current?.focus(); }, [newEntity]);
  useEffect(() => { if (addingToList) itemInput.current?.focus(); }, [addingToList]);
  useEffect(() => {
    if (!addingToList) return;
    const close = (event: PointerEvent) => {
      if (itemForm.current?.contains(event.target as Node)) return;
      setAddingToList(null);
      setNewItemText("");
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [addingToList]);
  useEffect(() => {
    if (!createMenuOpen) return;
    const close = (event: PointerEvent) => { if (!createMenu.current?.contains(event.target as Node)) setCreateMenuOpen(false); };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setCreateMenuOpen(false); };
    document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); };
  }, [createMenuOpen]);

  const openCreator = (type: "list" | "project", containerId: ContainerId = "ungrouped") => {
    setNewTitle("");
    setNewEntity(type === "list" ? { type, containerId } : { type });
    setCreateMenuOpen(false);
    if (containerId !== "ungrouped") setBoard((current) => ({ ...current, projects: current.projects.map((p) => p.id === containerId ? { ...p, collapsed: false } : p) }));
  };

  const addEntity = (event: FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || !newEntity) return;
    if (newEntity.type === "project") {
      setBoard((current) => ({ ...current, projects: [...current.projects, { id: makeId(), title, collapsed: false, lists: [] }] }));
    } else {
      const list: TodoList = { id: makeId(), title, items: [], collapsed: false };
      setBoard((current) => updateListsIn(current, newEntity.containerId ?? "ungrouped", [...(listsIn(current, newEntity.containerId ?? "ungrouped") ?? []), list]));
    }
    setNewEntity(null);
    setNewTitle("");
  };

  const addItem = (event: FormEvent, listId: string) => {
    event.preventDefault();
    const text = newItemText.trim();
    if (!text) return;
    setBoard((current) => mapLists(current, (list) => list.id === listId ? { ...list, items: [...list.items, { id: makeId(), text, completed: false }] } : list));
    setNewItemText(""); setAddingToList(null);
  };

  const startEditing = (type: "list" | "project", id: string, title: string) => { setEditing({ type, id }); setEditingTitle(title); };
  const saveTitle = () => {
    const title = editingTitle.trim();
    if (title && editing) {
      setBoard((current) => editing.type === "list"
        ? mapLists(current, (list) => list.id === editing.id ? { ...list, title } : list)
        : { ...current, projects: current.projects.map((project) => project.id === editing.id ? { ...project, title } : project) });
    }
    setEditing(null);
  };
  const titleKey = (event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") saveTitle(); if (event.key === "Escape") setEditing(null); };

  const toggleItem = (listId: string, itemId: string) => setBoard((current) => mapLists(current, (list) => list.id === listId ? { ...list, items: list.items.map((item) => item.id === itemId ? { ...item, completed: !item.completed } : item) } : list));
  const deleteItem = (listId: string, itemId: string) => setBoard((current) => mapLists(current, (list) => list.id === listId ? { ...list, items: list.items.filter((item) => item.id !== itemId) } : list));
  const deleteList = (list: TodoList) => {
    const detail = list.items.length ? ` and its ${list.items.length} task${list.items.length === 1 ? "" : "s"}` : "";
    if (!window.confirm(`Delete “${list.title}”${detail}?`)) return;
    setBoard((current) => ({ ...current, ungroupedLists: current.ungroupedLists.filter((l) => l.id !== list.id), projects: current.projects.map((p) => ({ ...p, lists: p.lists.filter((l) => l.id !== list.id) })) }));
  };
  const deleteProject = (project: TodoProject) => {
    const tasks = project.lists.reduce((sum, list) => sum + list.items.length, 0);
    if (!window.confirm(`Delete “${project.title}”, its ${project.lists.length} list${project.lists.length === 1 ? "" : "s"}, and ${tasks} task${tasks === 1 ? "" : "s"}?`)) return;
    setBoard((current) => ({ ...current, projects: current.projects.filter((p) => p.id !== project.id) }));
  };
  const toggleList = (list: TodoList) => {
    setBoard((current) => mapLists(current, (candidate) => candidate.id === list.id ? { ...candidate, collapsed: !candidate.collapsed } : candidate));
    if (!list.collapsed && addingToList === list.id) { setAddingToList(null); setNewItemText(""); }
  };

  const clearExpandTimer = () => {
    if (expandTimer.current !== null) window.clearTimeout(expandTimer.current);
    expandTimer.current = null; expandTarget.current = null;
  };
  const finishDrag = () => { clearExpandTimer(); setDragging(null); };

  const moveProject = (draggedId: string, targetId: string, position: "before" | "after") => setBoard((current) => {
    const from = current.projects.findIndex((p) => p.id === draggedId);
    if (from < 0 || draggedId === targetId) return current;
    const projects = [...current.projects]; const [moved] = projects.splice(from, 1);
    const target = projects.findIndex((p) => p.id === targetId); if (target < 0) return current;
    projects.splice(target + (position === "after" ? 1 : 0), 0, moved);
    return { ...current, projects };
  });

  const moveList = (listId: string, targetContainer: ContainerId, targetListId?: string, position: "before" | "after" = "after") => setBoard((current) => {
    let sourceContainer: ContainerId | undefined;
    let moved: TodoList | undefined;
    if (current.ungroupedLists.some((list) => list.id === listId)) { sourceContainer = "ungrouped"; moved = current.ungroupedLists.find((list) => list.id === listId); }
    else for (const project of current.projects) if (project.lists.some((list) => list.id === listId)) { sourceContainer = project.id; moved = project.lists.find((list) => list.id === listId); break; }
    if (!sourceContainer || !moved || listId === targetListId || !listsIn(current, targetContainer)) return current;
    let next = updateListsIn(current, sourceContainer, (listsIn(current, sourceContainer) ?? []).filter((list) => list.id !== listId));
    const destination = [...(listsIn(next, targetContainer) ?? [])];
    const target = targetListId ? destination.findIndex((list) => list.id === targetListId) : destination.length;
    destination.splice(target < 0 ? destination.length : target + (targetListId && position === "after" ? 1 : 0), 0, moved);
    return updateListsIn(next, targetContainer, destination);
  });

  const moveItem = (itemId: string, targetListId: string, targetItemId?: string, position: "before" | "after" = "after") => setBoard((current) => {
    const source = allLists(current).find((list) => list.items.some((item) => item.id === itemId));
    const moved = source?.items.find((item) => item.id === itemId);
    if (!source || !moved || itemId === targetItemId || !allLists(current).some((list) => list.id === targetListId)) return current;
    return mapLists(current, (list) => {
      let items = list.items.filter((item) => item.id !== itemId);
      if (list.id === targetListId) {
        const target = targetItemId ? items.findIndex((item) => item.id === targetItemId) : items.length;
        items = [...items]; items.splice(target < 0 ? items.length : target + (targetItemId && position === "after" ? 1 : 0), 0, moved);
      }
      return items === list.items ? list : { ...list, items };
    });
  });

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, value: DragState, label: string) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const selector = value.type === "project" ? ".todo-project" : value.type === "list" ? ".todo-list" : ".todo-item";
    const source = event.currentTarget.closest<HTMLElement>(selector);
    setDragging({ ...value, label, width: source?.offsetWidth ?? 220 });
    setDragPoint({ x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    if (!dragging) return;
    document.body.classList.add("is-todo-dragging");
    const move = (event: PointerEvent) => {
      event.preventDefault(); setDragPoint({ x: event.clientX, y: event.clientY });
      const hovered = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
      if (!hovered) return;
      const scroll = document.querySelector<HTMLElement>(".todo-panel__lists");
      if (scroll) { const bounds = scroll.getBoundingClientRect(); if (event.clientY < bounds.top + 32) scroll.scrollBy(0, -8); if (event.clientY > bounds.bottom - 32) scroll.scrollBy(0, 8); }
      if (dragging.type === "project") {
        const target = hovered.closest<HTMLElement>(".todo-project[data-project-id]");
        const id = target?.dataset.projectId; if (!target || !id || id === dragging.projectId) return;
        const bounds = target.getBoundingClientRect(); moveProject(dragging.projectId, id, event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"); return;
      }
      if (dragging.type === "list") {
        const project = hovered.closest<HTMLElement>(".todo-project[data-project-id]");
        const projectId = project?.dataset.projectId;
        if (projectId && project?.classList.contains("is-collapsed") && expandTarget.current !== projectId) {
          clearExpandTimer(); expandTarget.current = projectId;
          expandTimer.current = window.setTimeout(() => { setBoard((current) => ({ ...current, projects: current.projects.map((p) => p.id === projectId ? { ...p, collapsed: false } : p) })); clearExpandTimer(); }, EXPAND_DELAY);
        } else if (!projectId || !project?.classList.contains("is-collapsed")) clearExpandTimer();
        const targetList = hovered.closest<HTMLElement>(".todo-list[data-todo-list-id]");
        const targetId = targetList?.dataset.todoListId;
        const container = hovered.closest<HTMLElement>("[data-list-container]")?.dataset.listContainer;
        if (!container) return;
        if (targetList && targetId) { const bounds = targetList.getBoundingClientRect(); moveList(dragging.listId, container, targetId, event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"); }
        else moveList(dragging.listId, container);
        return;
      }
      const targetItem = hovered.closest<HTMLElement>("[data-todo-item-id]");
      const itemId = targetItem?.dataset.todoItemId; const listId = targetItem?.dataset.todoListId;
      if (targetItem && itemId && listId) { const bounds = targetItem.getBoundingClientRect(); moveItem(dragging.itemId, listId, itemId, event.clientY < bounds.top + bounds.height / 2 ? "before" : "after"); return; }
      const targetList = hovered.closest<HTMLElement>(".todo-list[data-todo-list-id]");
      if (targetList?.dataset.todoListId) moveItem(dragging.itemId, targetList.dataset.todoListId);
    };
    const key = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") finishDrag(); };
    window.addEventListener("pointermove", move, { passive: false }); window.addEventListener("pointerup", finishDrag); window.addEventListener("pointercancel", finishDrag); window.addEventListener("blur", finishDrag); window.addEventListener("keydown", key);
    return () => { document.body.classList.remove("is-todo-dragging"); clearExpandTimer(); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finishDrag); window.removeEventListener("pointercancel", finishDrag); window.removeEventListener("blur", finishDrag); window.removeEventListener("keydown", key); };
  }, [dragging]);

  const renderList = (list: TodoList, containerId: ContainerId) => {
    const remaining = list.items.filter((item) => !item.completed).length;
    const isDragging = dragging?.type === "list" && dragging.listId === list.id;
    const collapsed = list.collapsed === true;
    return <article key={list.id} className={`todo-list${isDragging ? " is-dragging" : ""}${collapsed ? " is-collapsed" : ""}`} data-todo-list-id={list.id}>
      <header className="todo-list__header">
        <button className="drag-handle" type="button" aria-label={`Drag ${list.title}`} title="Drag list" onPointerDown={(e) => beginDrag(e, { type: "list", listId: list.id, containerId }, list.title)}><GripIcon/></button>
        <button className={`todo-list__collapse${collapsed ? " is-collapsed" : ""}`} type="button" aria-label={`${collapsed ? "Expand" : "Collapse"} ${list.title}`} aria-expanded={!collapsed} onClick={() => toggleList(list)}><CollapseIcon/></button>
        <div className="todo-list__title-wrap">{editing?.type === "list" && editing.id === list.id
          ? <input className="todo-list__title-input" value={editingTitle} maxLength={60} autoFocus aria-label="List title" onChange={(e) => setEditingTitle(e.target.value)} onBlur={saveTitle} onKeyDown={titleKey}/>
          : <button className="todo-list__title" type="button" title="Rename list" onClick={() => startEditing("list", list.id, list.title)}>{list.title}</button>}
          <span className="todo-list__count">{remaining}</span></div>
        <button className="icon-button todo-list__delete" type="button" aria-label={`Delete ${list.title}`} onClick={() => deleteList(list)}><TrashIcon/></button>
      </header>
      <div className="todo-list__items">
        {list.items.map((item) => <div key={item.id} className={`todo-item${item.completed ? " is-complete" : ""}${dragging?.type === "item" && dragging.itemId === item.id ? " is-dragging" : ""}`} data-todo-list-id={list.id} data-todo-item-id={item.id}>
          <button className="todo-item__grip" type="button" aria-label={`Drag ${item.text}`} onPointerDown={(e) => beginDrag(e, { type: "item", listId: list.id, itemId: item.id }, item.text)}><GripIcon/></button>
          <label className="todo-item__label"><input type="checkbox" checked={item.completed} onChange={() => toggleItem(list.id, item.id)}/><span className="todo-item__check" aria-hidden="true"/><span className="todo-item__text">{item.text}</span></label>
          <button className="icon-button todo-item__delete" type="button" aria-label={`Delete ${item.text}`} onClick={() => deleteItem(list.id, item.id)}><TrashIcon/></button>
        </div>)}
        {!list.items.length && addingToList !== list.id && <p className="todo-list__empty">Nothing here yet</p>}
        {addingToList === list.id ? <form ref={itemForm} className="todo-list__new-item" onSubmit={(e) => addItem(e, list.id)}><input ref={itemInput} value={newItemText} maxLength={160} placeholder="What needs doing?" aria-label={`New task in ${list.title}`} onChange={(e) => setNewItemText(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setAddingToList(null); setNewItemText(""); } }}/><button type="submit" disabled={!newItemText.trim()}>Add</button></form>
          : <button className="todo-list__add-item" type="button" onClick={() => { setAddingToList(list.id); setNewItemText(""); }}><PlusIcon/>Add task</button>}
      </div>
    </article>;
  };

  const completed = lists.reduce((sum, list) => sum + list.items.filter((item) => item.completed).length, 0);
  const total = lists.reduce((sum, list) => sum + list.items.length, 0);
  const renderEntityForm = () => newEntity ? <form className="todo-panel__new-list" onSubmit={addEntity}><input ref={entityInput} value={newTitle} maxLength={60} placeholder={`${newEntity.type === "project" ? "Project" : "List"} name`} aria-label={`${newEntity.type} name`} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setNewEntity(null); }}/><button type="submit" disabled={!newTitle.trim()}>Add</button><button type="button" className="text-button" onClick={() => setNewEntity(null)}>Cancel</button></form> : null;

  return <section className="workspace__column todo-panel" aria-label="To-do lists">
    <header className="todo-panel__header"><div><p className="todo-panel__eyebrow"></p><h1>Projects</h1></div>
      <div className="todo-create" ref={createMenu}><button className="icon-button icon-button--accent" type="button" aria-label="Add a list or project" aria-haspopup="menu" aria-expanded={createMenuOpen} onClick={() => setCreateMenuOpen((open) => !open)}><PlusIcon/></button>
        {createMenuOpen && <div className="todo-create__menu" role="menu"><button role="menuitem" type="button" onClick={() => openCreator("list")}>Add to-do list</button><button role="menuitem" type="button" onClick={() => openCreator("project")}>Add project</button></div>}
      </div></header>
    <div className="todo-panel__summary" aria-live="polite"><span>{total - completed} left</span><span className="todo-panel__summary-divider"/><span>{completed} done</span></div>
    {newEntity?.type === "project" && renderEntityForm()}
    <div className="todo-panel__lists">
      <section className={`todo-group todo-group--ungrouped${board.ungroupedCollapsed ? " is-collapsed" : ""}`} data-list-container="ungrouped">
        <header className="todo-group__header"><button className={`todo-list__collapse${board.ungroupedCollapsed ? " is-collapsed" : ""}`} type="button" aria-label={`${board.ungroupedCollapsed ? "Expand" : "Collapse"} lists`} aria-expanded={!board.ungroupedCollapsed} onClick={() => setBoard((current) => ({ ...current, ungroupedCollapsed: !current.ungroupedCollapsed }))}><CollapseIcon/></button><h2>Lists</h2><span>{board.ungroupedLists.length}</span><button className="todo-group__add" type="button" onClick={() => openCreator("list")}><PlusIcon/> List</button></header>
        {!board.ungroupedCollapsed && <div className="todo-group__lists">{board.ungroupedLists.map((list) => renderList(list, "ungrouped"))}{newEntity?.type === "list" && newEntity.containerId === "ungrouped" && renderEntityForm()}{!board.ungroupedLists.length && newEntity?.containerId !== "ungrouped" && <p className="todo-group__empty">Drop lists here</p>}</div>}
      </section>
      {board.projects.map((project) => {
        const collapsed = project.collapsed;
        const projectDragging = dragging?.type === "project" && dragging.projectId === project.id;
        return <section key={project.id} className={`todo-project${collapsed ? " is-collapsed" : ""}${projectDragging ? " is-dragging" : ""}`} data-project-id={project.id} data-list-container={project.id}>
          <header className="todo-project__header"><button className="drag-handle todo-project__drag" type="button" aria-label={`Drag ${project.title}`} onPointerDown={(e) => beginDrag(e, { type: "project", projectId: project.id }, project.title)}><GripIcon/></button><button className={`todo-list__collapse${collapsed ? " is-collapsed" : ""}`} type="button" aria-label={`${collapsed ? "Expand" : "Collapse"} ${project.title}`} aria-expanded={!collapsed} onClick={() => setBoard((current) => ({ ...current, projects: current.projects.map((p) => p.id === project.id ? { ...p, collapsed: !p.collapsed } : p) }))}><CollapseIcon/></button>
            <div className="todo-project__title-wrap">{editing?.type === "project" && editing.id === project.id ? <input className="todo-list__title-input" value={editingTitle} maxLength={60} autoFocus aria-label="Project title" onChange={(e) => setEditingTitle(e.target.value)} onBlur={saveTitle} onKeyDown={titleKey}/> : <button className="todo-project__title" type="button" onClick={() => startEditing("project", project.id, project.title)}>{project.title}</button>}<span>{project.lists.length}</span></div>
            <button className="icon-button todo-project__add" type="button" aria-label={`Add list to ${project.title}`} onClick={() => openCreator("list", project.id)}><PlusIcon/></button><button className="icon-button todo-project__delete" type="button" aria-label={`Delete ${project.title}`} onClick={() => deleteProject(project)}><TrashIcon/></button>
          </header>
          {!collapsed && <div className="todo-project__lists">{project.lists.map((list) => renderList(list, project.id))}{newEntity?.type === "list" && newEntity.containerId === project.id && renderEntityForm()}{!project.lists.length && newEntity?.containerId !== project.id && <p className="todo-group__empty">Drop a list here or add one</p>}</div>}
        </section>;
      })}
      {!lists.length && !board.projects.length && <div className="todo-panel__empty"><span><PlusIcon/></span><h2>Start a new list</h2><p>Keep it ungrouped or organise it inside a project.</p><button type="button" onClick={() => openCreator("list")}>Add your first list</button></div>}
    </div>
    {dragging && <div className={`todo-drag-preview todo-drag-preview--${dragging.type}`} style={{ left: dragPoint.x, top: dragPoint.y, width: Math.min(dragging.width, 320) }} aria-hidden="true"><span className="todo-drag-preview__grip"><GripIcon/></span><span>{dragging.label}</span></div>}
  </section>;
}
