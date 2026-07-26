import { DuckButton } from "./DuckButton";
import { ToDoList } from "./ToDoList";
import "./Workspace.css";

/** The normal app window: three feature columns, with the duck in the last. */
export function Workspace() {
  return (
    <main className="workspace">
      <ToDoList />
      <section className="workspace__column" />
      <section className="workspace__column workspace__column--rows">
        <div className="workspace__pane" />
        <div className="workspace__pane workspace__pane--duck">
          <DuckButton />
        </div>
      </section>
    </main>
  );
}
