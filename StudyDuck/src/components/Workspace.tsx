<<<<<<< HEAD
import { DuckButton } from "./DuckButton";
import { ToDoList } from "./ToDoList";
import "./Workspace.css";
=======
import { DuckButton } from './DuckButton';
import { DuckChat } from './DuckChat';
import './Workspace.css';
>>>>>>> 569dcf08d1fa9308d42bbf4204532e30b861022e

/** The normal app window: three feature columns, with the duck in the last. */
export function Workspace() {
  return (
    <main className="workspace">
<<<<<<< HEAD
      <ToDoList />
      <section className="workspace__column" />
=======
      <section className="workspace__column" />
      <section className="workspace__column">
        <DuckChat />
      </section>
>>>>>>> 569dcf08d1fa9308d42bbf4204532e30b861022e
      <section className="workspace__column workspace__column--rows">
        <div className="workspace__pane" />
        <div className="workspace__pane workspace__pane--duck">
          <DuckButton />
        </div>
      </section>
    </main>
  );
}
