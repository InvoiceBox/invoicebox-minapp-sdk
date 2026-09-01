import { describe, expect, it } from 'vitest';
import {
    getChildProtocolVersion,
    isChildToParentMessage,
    isFeatureSupported,
    isParentToChildMessage,
} from './index';

describe('protocol guards', () => {
    it('isChildToParentMessage', () => {
        expect(isChildToParentMessage({ id: 'x', action: 'init', version: 2 })).toBe(true);
        expect(isChildToParentMessage({ id: 'x', action: 'height', data: 1 })).toBe(true);
        expect(isChildToParentMessage({ id: 'x', action: 'updateData' })).toBe(false);
        expect(isChildToParentMessage({ id: 1, action: 'init' })).toBe(false);
        expect(isChildToParentMessage('string')).toBe(false);
        expect(isChildToParentMessage(null)).toBe(false);
    });

    it('isParentToChildMessage', () => {
        expect(isParentToChildMessage({ id: 'x', action: 'init', data: {} })).toBe(true);
        expect(isParentToChildMessage({ id: 'x', action: 'updateData', data: {} })).toBe(true);
        expect(isParentToChildMessage({ id: 'x', action: 'paymentResult', data: 'completed' })).toBe(true);
        expect(isParentToChildMessage({ id: 'x', action: 'height', data: 1 })).toBe(false);
        expect(isParentToChildMessage(undefined)).toBe(false);
    });
});

describe('версионирование', () => {
    it('init без version — протокол v1', () => {
        expect(getChildProtocolVersion({ id: 'x', action: 'init' })).toBe(1);
        expect(getChildProtocolVersion({ id: 'x', action: 'init', version: 2 })).toBe(2);
    });

    it('isFeatureSupported: updateData доступен с v2', () => {
        expect(isFeatureSupported('updateData', 1)).toBe(false);
        expect(isFeatureSupported('updateData', 2)).toBe(true);
        expect(isFeatureSupported('updateData', 3)).toBe(true);
    });
});
