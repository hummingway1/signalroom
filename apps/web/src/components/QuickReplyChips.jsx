// apps/web/src/components/QuickReplyChips.jsx

export function QuickReplyChips({ choices, onPick, disabled }) {
  if (!choices || choices.length === 0) return null;
  return (
    <div className="quick-replies" role="group" aria-label="답장 후보">
      {choices.map((choice) => (
        <button key={choice.id} className="quick-reply-chip" onClick={() => onPick(choice)} disabled={disabled}>
          {choice.displayText}
        </button>
      ))}
    </div>
  );
}
