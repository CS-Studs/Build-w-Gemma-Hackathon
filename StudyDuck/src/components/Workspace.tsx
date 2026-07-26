import { DuckButton } from './DuckButton';
import { DuckChat } from './DuckChat';
import './Workspace.css';

/**
 * The normal app window: three columns, the last one split into two rows with
 * the duck sitting in the bottom one. The panes are empty scaffolding for the
 * study features.
 */
export function Workspace() {
  return (
    <main className="workspace">
      <section className="workspace__column" />
      <section className="workspace__column">
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
