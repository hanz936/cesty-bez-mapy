import { useState, useCallback, useRef } from 'react';

export function useListboxKeyboard({ isOpen, setIsOpen, options, getOptionValue, value, onSelect, triggerRef }) {
  const currentIdx = options.findIndex((o) => getOptionValue(o) === value);
  const [activeIndex, setActiveIndex] = useState(currentIdx >= 0 ? currentIdx : 0);
  const typeahead = useRef({ str: '', timer: null });

  const focusTrigger = useCallback(() => triggerRef?.current?.focus?.(), [triggerRef]);

  // commit = nastav hodnotu na options[idx] + zavři. BEZ návratu focusu (řeší volající dle klávesy).
  const commit = useCallback((idx) => {
    const opt = options[idx];
    if (opt !== undefined) onSelect(opt);
    setIsOpen(false);
  }, [options, onSelect, setIsOpen]);

  const onKeyDown = useCallback((e) => {
    const last = options.length - 1;
    const key = e.key;

    // Zavřeno: ArrowDown/ArrowUp/Enter/Space jen OTEVŘOU (APG openKeys)
    if (!isOpen && (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ' || key === 'Spacebar')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    // Home/End: posun aktivní option; fungují otevřeno i zavřeno (zavřeno → otevři)
    if (key === 'Home') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex(0);
      return;
    }
    if (key === 'End') {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex(last);
      return;
    }

    // Typeahead: tisknutelný znak (ne mezera, bez modifikátorů) → otevři + najdi shodu
    if (key.length === 1 && key !== ' ' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (!isOpen) setIsOpen(true);
      const t = typeahead.current;
      t.str += key.toLowerCase();
      if (t.timer) clearTimeout(t.timer);
      t.timer = setTimeout(() => { t.str = ''; }, 500);
      const match = options.findIndex((o) =>
        String(getOptionValue(o) ?? o).toLowerCase().startsWith(t.str)
      );
      if (match >= 0) setActiveIndex(match);
      return;
    }

    if (!isOpen) return;

    // Otevřeno:
    switch (key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(last, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (e.altKey) { commit(activeIndex); focusTrigger(); break; } // Alt+Up = commit (APG)
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case 'PageDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(last, i + 10));
        break;
      case 'PageUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 10));
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        focusTrigger();
        break;
      case 'Enter':
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        commit(activeIndex);
        focusTrigger();
        break;
      case 'Tab':
        commit(activeIndex); // BEZ preventDefault a BEZ focusTrigger → Tab přesune focus dál
        break;
      default:
        break;
    }
  }, [isOpen, activeIndex, options, getOptionValue, setIsOpen, commit, focusTrigger]);

  return { activeIndex, setActiveIndex, onKeyDown };
}
