/** Структурное сравнение JSON-совместимых значений (замена lodash.isequal). */
export const deepEqual = (a: unknown, b: unknown): boolean => {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
        return a.every((item, index) => deepEqual(item, b[index]));
    }

    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;

    return aKeys.every(
        (key) =>
            Object.prototype.hasOwnProperty.call(b, key) &&
            deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
};
