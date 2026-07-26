import { Widget } from "./components/Widget";
import { Workspace } from "./components/Workspace";
import { isWidgetWindow } from "./windows";

/** Both windows load this same bundle, so the window label picks the view. */
export function App() {
  return isWidgetWindow ? <Widget /> : <Workspace />;
}
