import { DuckButton } from './DuckButton';
import { DuckChat } from './DuckChat';
import { StudySession } from './studysession';
import { StatsSection } from './StatsSection';
import { ToDoList } from './ToDoList';
import { UserSection } from './UserSection';
import { Mindmap } from './Mindmap';
import { Flashcard } from './Flashcard';
import { Notes } from './Notes';

import './Workspace.css';

/** The normal app window: three feature columns, with the duck in the last. */
export function Workspace() {
  return (
    <main className="workspace">
      <section className="workspace__column workspace__column--first">
        <UserSection />
        <ToDoList />
      </section>
      <section className="workspace__column workspace__column--middle">
        <StudySession />
        <DuckChat />
      </section>
      <section className="workspace__column workspace__column--rows">
        <StatsSection />
        <div className="workspace__column-panes">
          <Mindmap />
          <Flashcard />
          <Notes />
          <button
            type="button"
            className="workspace__pane tool-trigger workspace__placeholder-tool"
            disabled
          >
            <h3>Feature tbd..</h3>
          </button>
          <button
            type="button"
            className="workspace__pane tool-trigger workspace__placeholder-tool"
            disabled
          >
            <h3>Feature tbd..</h3>
          </button>
          <div className="workspace__pane workspace__pane--duck">
            <DuckButton />
          </div>
        </div>
      </section>
    </main>
  );
}
