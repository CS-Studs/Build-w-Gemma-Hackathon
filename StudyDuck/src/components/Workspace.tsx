import { DuckButton } from "./DuckButton";
import { DuckChat } from "./DuckChat";
import { StudySession } from "./studysession";
import { ToDoList } from "./ToDoList";
import "./Workspace.css";

/** The normal app window: three feature columns, with the duck in the last. */
export function Workspace() {
  return (
    <main className="workspace">
      <section className="workspace__column">
        <ToDoList />
      </section>
      <section className="workspace__column workspace__column--middle">
        <StudySession />
        <DuckChat />
      </section>
      <section className="workspace__column workspace__column--rows">
        <div className="workspace__pane" />
        <div className="workspace__pane workspace__pane--duck">
          <DuckButton />
        </div>
      </section>
    </main>
  );
}
