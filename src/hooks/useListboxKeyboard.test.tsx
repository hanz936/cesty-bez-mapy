import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { useListboxKeyboard } from './useListboxKeyboard';

const options = ['Praha', 'Brno', 'Ostrava'];
const setup = (over = {}) => {
  const onSelect = vi.fn();
  const setIsOpen = vi.fn();
  const triggerRef = { current: { focus: vi.fn() } };
  const hook = renderHook(() =>
    useListboxKeyboard({
      isOpen: true, setIsOpen, options,
      getOptionValue: (o: string) => o, value: 'Praha', onSelect, triggerRef, ...over,
    })
  );
  return { hook, onSelect, setIsOpen, triggerRef };
};
const ev = (key: string, extra = {}) => ({ key, preventDefault: vi.fn(), shiftKey: false, ...extra }) as unknown as KeyboardEvent<HTMLElement>;

describe('useListboxKeyboard', () => {
  it('ArrowDown posune activeIndex dál', () => {
    const { hook } = setup();
    act(() => hook.result.current.onKeyDown(ev('ArrowDown')));
    expect(hook.result.current.activeIndex).toBe(1);
  });

  it('ArrowUp na indexu 0 nezůstane záporný', () => {
    const { hook } = setup();
    act(() => hook.result.current.onKeyDown(ev('ArrowUp')));
    expect(hook.result.current.activeIndex).toBe(0);
  });

  it('End skočí na poslední', () => {
    const { hook } = setup();
    act(() => hook.result.current.onKeyDown(ev('End')));
    expect(hook.result.current.activeIndex).toBe(2);
  });

  it('Enter commitne aktivní option a zavře', () => {
    const { hook, onSelect, setIsOpen } = setup();
    act(() => hook.result.current.onKeyDown(ev('ArrowDown')));
    act(() => hook.result.current.onKeyDown(ev('Enter')));
    expect(onSelect).toHaveBeenCalledWith('Brno');
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it('Escape zavře a vrátí focus na trigger', () => {
    const { hook, setIsOpen, triggerRef } = setup();
    act(() => hook.result.current.onKeyDown(ev('Escape')));
    expect(setIsOpen).toHaveBeenCalledWith(false);
    expect(triggerRef.current.focus).toHaveBeenCalled();
  });

  it('Tab commitne aktivní option ale NEvrací focus (Tab pokračuje dál)', () => {
    const { hook, onSelect, setIsOpen, triggerRef } = setup();
    act(() => hook.result.current.onKeyDown(ev('ArrowDown')));
    act(() => hook.result.current.onKeyDown(ev('Tab')));
    expect(onSelect).toHaveBeenCalledWith('Brno');
    expect(setIsOpen).toHaveBeenCalledWith(false);
    expect(triggerRef.current.focus).not.toHaveBeenCalled();
  });

  it('typeahead na "b" aktivuje Brno', () => {
    const { hook } = setup();
    act(() => hook.result.current.onKeyDown(ev('b')));
    expect(hook.result.current.activeIndex).toBe(1);
  });
});
