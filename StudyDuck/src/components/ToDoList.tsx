import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import "./ToDoList.css";

type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
};

type TodoList = {
  id: string;
  title: string;
  items: TodoItem[];
  collapsed?: boolean;
};

type DragState =
  | { type: "list"; listId: string }
  | { type: "item"; listId: string; itemId: string };

type PointerDragState = DragState & {
  label: string;
  width: number;
};

const STORAGE_KEY = "studyduck.todo-lists.v1";

function makeId() {
  return crypto.randomUUID();
}

function isTodoLists(value: unknown): value is TodoList[] {
  if (!Array.isArray(value)) return false;

  return value.every(
    (list) =>
      typeof list === "object" &&
      list !== null &&
      typeof list.id === "string" &&
      typeof list.title === "string" &&
      (typeof (list as TodoList).collapsed === "undefined" ||
        typeof (list as TodoList).collapsed === "boolean") &&
      Array.isArray(list.items) &&
      list.items.every(
        (item: unknown) =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as TodoItem).id === "string" &&
          typeof (item as TodoItem).text === "string" &&
          typeof (item as TodoItem).completed === "boolean",
      ),
  );
}

function loadLists(): TodoList[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const value: unknown = JSON.parse(stored);
      if (isTodoLists(value)) return value;
    }
  } catch {
    // Storage may be disabled or contain data from an older app version.
  }

  return [{ id: makeId(), title: "My tasks", items: [], collapsed: false }];
}

function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="5" cy="4" r="1" />
      <circle cx="11" cy="4" r="1" />
      <circle cx="5" cy="8" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="5" cy="12" r="1" />
      <circle cx="11" cy="12" r="1" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 4h10M6 4V2.75h4V4m2 0-.65 9H4.65L4 4m2.5 2v4.5m3-4.5v4.5" />
    </svg>
  );
}

/** A locally persisted collection of draggable task lists. */
export function ToDoList() {
  const [lists, setLists] = useState<TodoList[]>(loadLists);
  const [newListTitle, setNewListTitle] = useState("");
  const [addingList, setAddingList] = useState(false);
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [dragging, setDragging] = useState<PointerDragState | null>(null);
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });
  const newListInput = useRef<HTMLInputElement>(null);
  const newItemInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
    } catch {
      // The board still works for the current session when storage is blocked.
    }
  }, [lists]);

  useEffect(() => {
    if (addingList) newListInput.current?.focus();
  }, [addingList]);

  useEffect(() => {
    if (addingToList) newItemInput.current?.focus();
  }, [addingToList]);

  const addList = (event: FormEvent) => {
    event.preventDefault();
    const title = newListTitle.trim();
    if (!title) return;

    setLists((current) => [
      ...current,
      { id: makeId(), title, items: [], collapsed: false },
    ]);
    setNewListTitle("");
    setAddingList(false);
  };

  const addItem = (event: FormEvent, listId: string) => {
    event.preventDefault();
    const text = newItemText.trim();
    if (!text) return;

    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: [
                ...list.items,
                { id: makeId(), text, completed: false },
              ],
            }
          : list,
      ),
    );
    setNewItemText("");
    setAddingToList(null);
  };

  const startEditingList = (list: TodoList) => {
    setEditingListId(list.id);
    setEditingTitle(list.title);
  };

  const saveListTitle = () => {
    const title = editingTitle.trim();
    if (title && editingListId) {
      setLists((current) =>
        current.map((list) =>
          list.id === editingListId ? { ...list, title } : list,
        ),
      );
    }
    setEditingListId(null);
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") saveListTitle();
    if (event.key === "Escape") setEditingListId(null);
  };

  const toggleItem = (listId: string, itemId: string) => {
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              items: list.items.map((item) =>
                item.id === itemId
                  ? { ...item, completed: !item.completed }
                  : item,
              ),
            }
          : list,
      ),
    );
  };

  const deleteItem = (listId: string, itemId: string) => {
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? { ...list, items: list.items.filter((item) => item.id !== itemId) }
          : list,
      ),
    );
  };

  const deleteList = (list: TodoList) => {
    const detail = list.items.length
      ? ` and its ${list.items.length} task${list.items.length === 1 ? "" : "s"}`
      : "";
    if (!window.confirm(`Delete “${list.title}”${detail}?`)) return;
    setLists((current) => current.filter((item) => item.id !== list.id));
  };

  const toggleListCollapsed = (list: TodoList) => {
    const collapsed = !list.collapsed;
    setLists((current) =>
      current.map((item) =>
        item.id === list.id ? { ...item, collapsed } : item,
      ),
    );
    if (collapsed && addingToList === list.id) {
      setAddingToList(null);
      setNewItemText("");
    }
  };

  const finishDrag = () => {
    setDragging(null);
  };

  const reorderList = (
    draggedListId: string,
    targetListId: string,
    position: "before" | "after",
  ) => {
    setLists((current) => {
      const from = current.findIndex((list) => list.id === draggedListId);
      if (from < 0 || draggedListId === targetListId) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      const targetIndex = next.findIndex((list) => list.id === targetListId);
      if (targetIndex < 0) return current;
      const insertAt = targetIndex + (position === "after" ? 1 : 0);
      next.splice(insertAt, 0, moved);
      if (next.every((list, index) => list.id === current[index]?.id)) {
        return current;
      }
      return next;
    });
  };

  const reorderItem = (
    draggedItemId: string,
    targetListId: string,
    targetItemId?: string,
    position: "before" | "after" = "after",
  ) => {
    setLists((current) => {
      const sourceList = current.find((list) =>
        list.items.some((item) => item.id === draggedItemId),
      );
      if (!sourceList) return current;
      const moved = sourceList.items.find((item) => item.id === draggedItemId);
      if (!moved || moved.id === targetItemId) return current;

      const withoutMoved = current.map((list) =>
        list.id === sourceList.id
          ? { ...list, items: list.items.filter((item) => item.id !== moved.id) }
          : list,
      );

      const next = withoutMoved.map((list) => {
        if (list.id !== targetListId) return list;
        const items = [...list.items];
        const targetIndex = targetItemId
          ? items.findIndex((item) => item.id === targetItemId)
          : items.length;
        const insertAt =
          targetIndex < 0
            ? items.length
            : targetIndex + (position === "after" ? 1 : 0);
        items.splice(insertAt, 0, moved);
        return { ...list, items };
      });

      const unchanged = next.every((list, listIndex) =>
        list.items.every(
          (item, itemIndex) =>
            item.id === current[listIndex]?.items[itemIndex]?.id,
        ),
      );
      return unchanged ? current : next;
    });
  };

  const beginPointerDrag = (
    event: ReactPointerEvent<HTMLElement>,
    value: DragState,
    label: string,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const source = event.currentTarget.closest<HTMLElement>(
      value.type === "list" ? ".todo-list" : ".todo-item",
    );
    setDragging({ ...value, label, width: source?.offsetWidth ?? 220 });
    setDragPoint({ x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    if (!dragging) return;

    document.body.classList.add("is-todo-dragging");

    const handlePointerMove = (event: PointerEvent) => {
      event.preventDefault();
      setDragPoint({ x: event.clientX, y: event.clientY });

      const hovered = document.elementFromPoint(
        event.clientX,
        event.clientY,
      ) as HTMLElement | null;
      if (!hovered) return;

      const scrollArea = document.querySelector<HTMLElement>(
        ".todo-panel__lists",
      );
      if (scrollArea) {
        const scrollBounds = scrollArea.getBoundingClientRect();
        if (event.clientY < scrollBounds.top + 32) scrollArea.scrollBy(0, -8);
        if (event.clientY > scrollBounds.bottom - 32) scrollArea.scrollBy(0, 8);
      }

      if (dragging.type === "list") {
        const target = hovered.closest<HTMLElement>(
          ".todo-list[data-todo-list-id]",
        );
        const targetListId = target?.dataset.todoListId;
        if (!target || !targetListId || targetListId === dragging.listId) return;
        const bounds = target.getBoundingClientRect();
        reorderList(
          dragging.listId,
          targetListId,
          event.clientY < bounds.top + bounds.height / 2 ? "before" : "after",
        );
        return;
      }

      const targetItem = hovered.closest<HTMLElement>("[data-todo-item-id]");
      const targetItemId = targetItem?.dataset.todoItemId;
      const targetListId = targetItem?.dataset.todoListId;
      if (targetItem && targetItemId && targetListId) {
        const bounds = targetItem.getBoundingClientRect();
        reorderItem(
          dragging.itemId,
          targetListId,
          targetItemId,
          event.clientY < bounds.top + bounds.height / 2 ? "before" : "after",
        );
        return;
      }

      const targetList = hovered.closest<HTMLElement>(
        ".todo-list[data-todo-list-id]",
      );
      const emptyTargetListId = targetList?.dataset.todoListId;
      if (emptyTargetListId) {
        reorderItem(dragging.itemId, emptyTargetListId);
      }
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") finishDrag();
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("blur", finishDrag);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("is-todo-dragging");
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      window.removeEventListener("blur", finishDrag);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dragging]);

  const completedCount = lists.reduce(
    (total, list) =>
      total + list.items.filter((item) => item.completed).length,
    0,
  );
  const totalCount = lists.reduce((total, list) => total + list.items.length, 0);

  return (
    <section className="workspace__column todo-panel" aria-label="To-do lists">
        <header className="todo-panel__header">
          <div>
            <p className="todo-panel__eyebrow">Your workspace</p>
            <h1>To do</h1>
          </div>
          <button
            className="icon-button icon-button--accent"
            type="button"
            aria-label="Add a list"
            title="Add a list"
            onClick={() => setAddingList(true)}
          >
            <PlusIcon />
          </button>
        </header>

        <div className="todo-panel__summary" aria-live="polite">
          <span>{totalCount - completedCount} left</span>
          <span className="todo-panel__summary-divider" />
          <span>{completedCount} done</span>
        </div>

        {addingList && (
          <form className="todo-panel__new-list" onSubmit={addList}>
            <input
              ref={newListInput}
              value={newListTitle}
              maxLength={60}
              placeholder="List name"
              aria-label="List name"
              onChange={(event) => setNewListTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setAddingList(false);
              }}
            />
            <button type="submit" disabled={!newListTitle.trim()}>
              Add
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setAddingList(false)}
            >
              Cancel
            </button>
          </form>
        )}

        <div className="todo-panel__lists">
          {lists.map((list) => {
            const remaining = list.items.filter((item) => !item.completed).length;
            const isListDragging =
              dragging?.type === "list" && dragging.listId === list.id;
            const isCollapsed = list.collapsed === true;

            return (
              <article
                key={list.id}
                className={`todo-list${isListDragging ? " is-dragging" : ""}${
                  isCollapsed ? " is-collapsed" : ""
                }`}
                data-todo-list-id={list.id}
              >
                <header className="todo-list__header">
                  <button
                    className="drag-handle"
                    type="button"
                    aria-label={`Drag to reorder ${list.title}`}
                    title="Drag to reorder list"
                    onPointerDown={(event) =>
                      beginPointerDrag(
                        event,
                        { type: "list", listId: list.id },
                        list.title,
                      )
                    }
                  >
                    <GripIcon />
                  </button>

                  <button
                    className={`todo-list__collapse${
                      isCollapsed ? " is-collapsed" : ""
                    }`}
                    type="button"
                    aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${
                      list.title
                    }`}
                    aria-expanded={!isCollapsed}
                    title={isCollapsed ? "Expand list" : "Collapse list"}
                    onClick={() => toggleListCollapsed(list)}
                  >
                    <CollapseIcon />
                  </button>

                  <div className="todo-list__title-wrap">
                    {editingListId === list.id ? (
                      <input
                        className="todo-list__title-input"
                        value={editingTitle}
                        maxLength={60}
                        aria-label="List title"
                        autoFocus
                        onChange={(event) => setEditingTitle(event.target.value)}
                        onBlur={saveListTitle}
                        onKeyDown={handleTitleKeyDown}
                      />
                    ) : (
                      <button
                        className="todo-list__title"
                        type="button"
                        title="Rename list"
                        onClick={() => startEditingList(list)}
                      >
                        {list.title}
                      </button>
                    )}
                    <span className="todo-list__count">{remaining}</span>
                  </div>

                  <button
                    className="icon-button todo-list__delete"
                    type="button"
                    aria-label={`Delete ${list.title}`}
                    title="Delete list"
                    onClick={() => deleteList(list)}
                  >
                    <TrashIcon />
                  </button>
                </header>

                <div className="todo-list__items">
                  {list.items.map((item) => {
                    const isItemDragging =
                      dragging?.type === "item" && dragging.itemId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`todo-item${item.completed ? " is-complete" : ""}${
                          isItemDragging ? " is-dragging" : ""
                        }`}
                        data-todo-list-id={list.id}
                        data-todo-item-id={item.id}
                      >
                        <button
                          className="todo-item__grip"
                          type="button"
                          aria-label={`Drag to reorder ${item.text}`}
                          title="Drag to reorder task"
                          onPointerDown={(event) =>
                            beginPointerDrag(
                              event,
                              {
                                type: "item",
                                listId: list.id,
                                itemId: item.id,
                              },
                              item.text,
                            )
                          }
                        >
                          <GripIcon />
                        </button>
                        <label className="todo-item__label">
                          <input
                            type="checkbox"
                            checked={item.completed}
                            onChange={() => toggleItem(list.id, item.id)}
                          />
                          <span className="todo-item__check" aria-hidden="true" />
                          <span className="todo-item__text">{item.text}</span>
                        </label>
                        <button
                          className="icon-button todo-item__delete"
                          type="button"
                          aria-label={`Delete ${item.text}`}
                          title="Delete task"
                          onClick={() => deleteItem(list.id, item.id)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    );
                  })}

                  {list.items.length === 0 && addingToList !== list.id && (
                    <p className="todo-list__empty">Nothing here yet</p>
                  )}

                  {addingToList === list.id ? (
                    <form
                      className="todo-list__new-item"
                      onSubmit={(event) => addItem(event, list.id)}
                    >
                      <input
                        ref={newItemInput}
                        value={newItemText}
                        maxLength={160}
                        placeholder="What needs doing?"
                        aria-label={`New task in ${list.title}`}
                        onChange={(event) => setNewItemText(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setAddingToList(null);
                        }}
                      />
                      <button type="submit" disabled={!newItemText.trim()}>
                        Add
                      </button>
                    </form>
                  ) : (
                    <button
                      className="todo-list__add-item"
                      type="button"
                      onClick={() => {
                        setAddingToList(list.id);
                        setNewItemText("");
                      }}
                    >
                      <PlusIcon />
                      Add task
                    </button>
                  )}
                </div>
              </article>
            );
          })}

          {lists.length === 0 && (
            <div className="todo-panel__empty">
              <span><PlusIcon /></span>
              <h2>Start a new list</h2>
              <p>Group tasks by subject, project, or priority.</p>
              <button type="button" onClick={() => setAddingList(true)}>
                Add your first list
              </button>
            </div>
          )}
        </div>
        {dragging && (
          <div
            className={`todo-drag-preview todo-drag-preview--${dragging.type}`}
            style={{
              left: dragPoint.x,
              top: dragPoint.y,
              width: Math.min(dragging.width, 320),
            }}
            aria-hidden="true"
          >
            <span className="todo-drag-preview__grip">
              <GripIcon />
            </span>
            <span>{dragging.label}</span>
          </div>
        )}
    </section>
  );
}
