import { useEffect, useRef, useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';

export default function Select({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <label className="block text-sm">
      {label && <span className="mb-1 block text-discord-muted">{label}</span>}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-lg border border-discord-border bg-discord-input px-3 py-2 text-left text-sm text-discord-text transition-ui hover:bg-discord-elevated"
        >
          <span>{selected?.label ?? value}</span>
          <IconChevronDown size={16} className="text-discord-muted" />
        </button>
        {open && (
          <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-discord-border bg-discord-elevated py-1 shadow-lg">
            {options.map((opt) => (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm transition-ui hover:bg-discord-input ${
                    opt.value === value ? 'text-discord-accent' : 'text-discord-text'
                  }`}
                >
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </label>
  );
}
