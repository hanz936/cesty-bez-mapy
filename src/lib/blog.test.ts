import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Chainovatelný mock query builderu: každá metoda vrací `this`,
// terminál je await (thenable) → vrátí { data, error } z _result.
interface MockBuilder {
  _result: { data: unknown; error: unknown };
  then(resolve: (value: unknown) => unknown): Promise<unknown>;
  maybeSingle: Mock;
  _calls: unknown[][];
  [method: string]: unknown;
}
function makeBuilder(): MockBuilder {
  const calls: unknown[][] = [];
  const builder = {
    _result: { data: [], error: null },
    then(this: MockBuilder, resolve: (value: unknown) => unknown) { return Promise.resolve(this._result).then(resolve); },
  } as unknown as MockBuilder;
  ['select', 'eq', 'neq', 'not', 'lte', 'in', 'overlaps', 'order', 'limit'].forEach((m) => {
    builder[m] = vi.fn((...args: unknown[]) => { calls.push([m, ...args]); return builder; });
  });
  builder.maybeSingle = vi.fn(() => Promise.resolve(builder._result));
  builder._calls = calls;
  return builder;
}

const fromMock = vi.fn<(...args: unknown[]) => unknown>();
vi.mock('./supabase', () => ({ supabase: { from: (...a: unknown[]) => fromMock(...a) } }));

import { fetchPublishedPosts, fetchPostBySlug, fetchRelatedPosts, fetchExistingProductSlugs } from './blog';

beforeEach(() => { fromMock.mockReset(); });

describe('fetchPublishedPosts', () => {
  it('filtruje na published a řadí sestupně', async () => {
    const b = makeBuilder();
    b._result = { data: [{ id: '1' }], error: null };
    fromMock.mockReturnValue(b);
    const res = await fetchPublishedPosts();
    expect(fromMock).toHaveBeenCalledWith('blog_posts');
    expect(b.not).toHaveBeenCalledWith('published_at', 'is', null);
    expect(b.order).toHaveBeenCalledWith('published_at', { ascending: false });
    expect(res).toEqual([{ id: '1' }]);
  });
});

describe('fetchPostBySlug', () => {
  it('hledá podle slug + published a vrací maybeSingle', async () => {
    const b = makeBuilder();
    b._result = { data: { id: '1', slug: 'x' }, error: null };
    fromMock.mockReturnValue(b);
    const res = await fetchPostBySlug('x');
    expect(b.eq).toHaveBeenCalledWith('slug', 'x');
    expect(b.maybeSingle).toHaveBeenCalled();
    expect(res).toEqual({ id: '1', slug: 'x' });
  });
});

describe('fetchRelatedPosts', () => {
  it('vrátí [] bez tagů (žádný dotaz)', async () => {
    const res = await fetchRelatedPosts([], 'id1');
    expect(res).toEqual([]);
    expect(fromMock).not.toHaveBeenCalled();
  });
  it('používá overlaps a vylučuje aktuální článek', async () => {
    const b = makeBuilder();
    b._result = { data: [{ id: '2' }], error: null };
    fromMock.mockReturnValue(b);
    const res = await fetchRelatedPosts(['t1'], 'id1');
    expect(b.overlaps).toHaveBeenCalledWith('tag_ids', ['t1']);
    expect(b.neq).toHaveBeenCalledWith('id', 'id1');
    expect(res).toEqual([{ id: '2' }]);
  });
});

describe('fetchExistingProductSlugs', () => {
  it('vrátí Set existujících slugů', async () => {
    const b = makeBuilder();
    b._result = { data: [{ slug: 'a' }], error: null };
    fromMock.mockReturnValue(b);
    const res = await fetchExistingProductSlugs(['a', 'b', 'a']);
    expect(b.in).toHaveBeenCalledWith('slug', ['a', 'b']);
    expect(res.has('a')).toBe(true);
    expect(res.has('b')).toBe(false);
  });
  it('prázdný vstup → prázdný Set, žádný dotaz', async () => {
    const res = await fetchExistingProductSlugs([]);
    expect(res.size).toBe(0);
    expect(fromMock).not.toHaveBeenCalled();
  });
});
