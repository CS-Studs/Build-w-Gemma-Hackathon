import angryDuck from "../assets/anger.png";
import defaultDuck from "../assets/default.png";
import happyDuck from "../assets/happy.png";
import heart from "../assets/heart.gif";
import type { DuckMood } from "../hooks/useDuckMood";
import "./Duck.css";

const ARTWORK: Record<DuckMood, string> = {
  default: defaultDuck,
  happy: happyDuck,
  angry: angryDuck,
};

const MOOD_LABEL: Record<DuckMood, string> = {
  default: "StudyDuck",
  happy: "StudyDuck, pleased",
  angry: "StudyDuck, unimpressed",
};

type DuckProps = {
  mood?: DuckMood;
  hearts?: boolean;
};

/**
 * The duck artwork at widget size. Presentation only, no behaviour.
 *
 * Both props default to the resting state so the workspace button, which has no
 * mood of its own, keeps rendering exactly as it always has.
 */
export function Duck({ mood = "default", hearts = false }: DuckProps) {
  return (
    <div className="duck-figure">
      <img
        className="duck"
        src={ARTWORK[mood]}
        alt={MOOD_LABEL[mood]}
        draggable={false}
      />
      {hearts && (
        <>
          {/* Decorative, so deliberately unlabelled: the mood is already in the
              duck's own alt text and screen readers should not hear it twice. */}
          <img
            className="duck__heart duck__heart--upper-right"
            src={heart}
            alt=""
            draggable={false}
          />
          <img
            className="duck__heart duck__heart--middle-left"
            src={heart}
            alt=""
            draggable={false}
          />
        </>
      )}
    </div>
  );
}
