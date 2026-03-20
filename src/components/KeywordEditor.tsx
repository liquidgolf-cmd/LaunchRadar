import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface KeywordEditorProps {
  keywords: string[];
  onChange: (keywords: string[]) => void;
}

export default function KeywordEditor({ keywords, onChange }: KeywordEditorProps) {
  const [input, setInput] = useState('');

  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    onChange([...keywords, trimmed]);
    setInput('');
  };

  const remove = (kw: string) => {
    onChange(keywords.filter((k) => k !== kw));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    }
    if (e.key === 'Backspace' && input === '' && keywords.length > 0) {
      remove(keywords[keywords.length - 1]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 p-3 border border-[#e2e8f0] rounded bg-white min-h-[48px]
                    focus-within:ring-2 focus-within:ring-[#f97316] focus-within:border-transparent">
      {keywords.map((kw) => (
        <span
          key={kw}
          className="flex items-center gap-1.5 bg-[#0f172a] text-white text-xs font-medium
                     px-2.5 py-1 rounded"
        >
          {kw}
          <button
            type="button"
            onClick={() => remove(kw)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => add(input)}
        placeholder={keywords.length === 0 ? 'Type a keyword and press Enter…' : ''}
        className="flex-1 min-w-[140px] text-sm text-[#0f172a] outline-none placeholder-[#94a3b8]
                   bg-transparent"
      />
    </div>
  );
}
