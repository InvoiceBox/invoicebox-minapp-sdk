import { describe, expect, it } from 'vitest';
import { deepEqual } from './deepEqual';

describe('deepEqual', () => {
    it('примитивы и NaN', () => {
        expect(deepEqual(1, 1)).toBe(true);
        expect(deepEqual('a', 'b')).toBe(false);
        expect(deepEqual(NaN, NaN)).toBe(true);
        expect(deepEqual(null, undefined)).toBe(false);
    });

    it('объекты и массивы вглубь', () => {
        expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
        expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
        expect(deepEqual([1, 2], [2, 1])).toBe(false);
        expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
        expect(deepEqual([], {})).toBe(false);
    });
});
