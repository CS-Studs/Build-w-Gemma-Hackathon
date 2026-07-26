import "./SpeechBubble.css";

export type SpeechBubbleProps = {
  text: string;
  visible: boolean;
};

/** A speech bubble that rises out of whatever positioned element contains it. */
export function SpeechBubble({ text, visible }: SpeechBubbleProps) {
  return (
    <div
      className={visible ? "speech-bubble is-visible" : "speech-bubble"}
      role="status"
    >
      {text}
    </div>
  );
}
