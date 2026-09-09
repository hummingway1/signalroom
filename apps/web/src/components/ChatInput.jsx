// apps/web/src/components/ChatInput.jsx
import { useState } from 'react';

const MAX_QUESTION_LENGTH = 50; // §6 확정 정책 — 백엔드(charts.mjs/conversations.mjs)와 동일한 제한

export function ChatInput({ characterId, onSend }) {
  const [value, setValue] = useState('');
  const characterName = characterId === 'manggu' ? '맹구' : '대구';

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_QUESTION_LENGTH) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const isTooLong = value.length > MAX_QUESTION_LENGTH;

  return (
    <div className="chat-input">
      <div className="chat-input__field-wrap">
        <textarea
          className="chat-input__field"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${characterName}에게 이야기해보세요... (최대 ${MAX_QUESTION_LENGTH}자)`}
          maxLength={MAX_QUESTION_LENGTH}
          rows={1}
        />
        {value.length > 0 && (
          <span className={`chat-input__counter${isTooLong ? ' chat-input__counter--over' : ''}`}>
            {value.length}/{MAX_QUESTION_LENGTH}
          </span>
        )}
      </div>
      <button
        className={`chat-input__send${value.trim() && !isTooLong ? ' chat-input__send--active' : ''}`}
        onClick={submit}
        disabled={!value.trim() || isTooLong}
        aria-label="보내기"
      >
        ↑
      </button>
    </div>
  );
}
