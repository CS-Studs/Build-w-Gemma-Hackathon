import duck from "../assets/default.gif";
import "./Duck.css";

/** The duck artwork at widget size. Presentation only, no behaviour. */
export function Duck() {
  return <img className="duck" src={duck} alt="StudyDuck" draggable={false} />;
}
