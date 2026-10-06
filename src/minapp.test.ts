import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMinapp, InvoiceboxMinapp } from './minapp';
import { PROTOCOL_VERSION, TInitialData, TParentToChildMessage } from './protocol/index';

const PARENT_ORIGIN = 'https://pay.example.com';
const APP_ID = 'test-app-id';

const INITIAL_DATA: TInitialData = {
    public: {
        shopId: 1,
        userEmail: 'user@example.com',
        userName: 'User',
        userPhone: '+70000000000',
        locale: 'ru',
        orderContainerId: 'oc-1',
        minappType: 'suborder',
        fullHeight: false,
    },
    private: { metaData: [{ iataCode: 'SVO', nested: { iataCode: 'DME' } }] },
};

type TSentMessage = { message: unknown; targetOrigin: string };

let sentToParent: TSentMessage[] = [];
let app: InvoiceboxMinapp | null = null;

const emulateParentMessage = (message: TParentToChildMessage, origin: string = PARENT_ORIGIN) => {
    window.dispatchEvent(new MessageEvent('message', { data: message, origin }));
};

beforeEach(() => {
    sentToParent = [];
    window.history.replaceState(null, '', `/?id=${APP_ID}`);
    Object.defineProperty(window, 'parent', {
        configurable: true,
        value: {
            postMessage: (message: unknown, targetOrigin: string) => {
                sentToParent.push({ message, targetOrigin });
            },
        },
    });
});

afterEach(() => {
    app?.disconnect();
    app = null;
    vi.useRealTimers();
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
});

const connect = (options?: ConstructorParameters<typeof InvoiceboxMinapp>[0]) => {
    app = createMinapp({ parentOrigin: PARENT_ORIGIN, ...options });
    app.connect();
    return app;
};

describe('handshake', () => {
    it('шлёт init с версией протокола и targetOrigin родителя', () => {
        connect();
        expect(sentToParent).toHaveLength(1);
        expect(sentToParent[0]).toEqual({
            message: { id: APP_ID, action: 'init', version: PROTOCOL_VERSION },
            targetOrigin: PARENT_ORIGIN,
        });
    });

    it('ретраит init до ответа родителя, после ответа останавливается', () => {
        vi.useFakeTimers();
        connect();
        vi.advanceTimersByTime(1500);
        expect(sentToParent.length).toBe(4); // 1 сразу + 3 ретрая

        emulateParentMessage({ id: APP_ID, action: 'init', data: INITIAL_DATA });
        vi.advanceTimersByTime(3000);
        expect(sentToParent.length).toBe(4);
    });

    it('getInitialData резолвится данными из init', async () => {
        const instance = connect();
        const promise = instance.getInitialData();
        emulateParentMessage({ id: APP_ID, action: 'init', data: INITIAL_DATA });
        await expect(promise).resolves.toEqual(INITIAL_DATA.public);
    });

    it('getInitialData отдаёт самостоятельный заказ в iframe (order без fullHeight)', async () => {
        const webOrder: TInitialData = {
            public: {
                userEmail: '',
                userName: '',
                userPhone: '',
                locale: 'ru',
                minappType: 'order',
                fullHeight: false,
            },
            private: { metaData: [] },
        };
        const instance = connect();
        const promise = instance.getInitialData();
        emulateParentMessage({ id: APP_ID, action: 'init', data: webOrder });
        await expect(promise).resolves.toEqual(webOrder.public);
    });

    it('getInitialData реджектится по таймауту без ответа родителя', async () => {
        vi.useFakeTimers();
        const instance = connect({ initTimeoutMs: 1000 });
        const promise = instance.getInitialData();
        promise.catch(() => {});
        vi.advanceTimersByTime(1001);
        await expect(promise).rejects.toThrow('no init response');
    });

    it('connect идемпотентен (StrictMode)', () => {
        const instance = connect();
        instance.connect();
        expect(sentToParent).toHaveLength(1);
        instance.disconnect();
        expect(() => instance.disconnect()).not.toThrow();
    });
});

describe('фильтрация входящих', () => {
    it('игнорирует сообщения с чужим origin', async () => {
        vi.useFakeTimers();
        const instance = connect({ initTimeoutMs: 1000 });
        const promise = instance.getInitialData();
        promise.catch(() => {});

        emulateParentMessage({ id: APP_ID, action: 'init', data: INITIAL_DATA }, 'https://evil.example.com');
        vi.advanceTimersByTime(1001);
        await expect(promise).rejects.toThrow();
    });

    it('принимает сообщения с собственного origin (RN WebView inject)', async () => {
        const instance = connect();
        const promise = instance.getInitialData();
        emulateParentMessage({ id: APP_ID, action: 'init', data: INITIAL_DATA }, window.location.origin);
        await expect(promise).resolves.toEqual(INITIAL_DATA.public);
    });

    it('игнорирует чужой id и невалидные сообщения', async () => {
        vi.useFakeTimers();
        const instance = connect({ initTimeoutMs: 1000 });
        const promise = instance.getInitialData();
        promise.catch(() => {});

        emulateParentMessage({ id: 'other-id', action: 'init', data: INITIAL_DATA });
        window.dispatchEvent(new MessageEvent('message', { data: 'garbage', origin: PARENT_ORIGIN }));
        vi.advanceTimersByTime(1001);
        await expect(promise).rejects.toThrow();
    });
});

describe('updateData (v2)', () => {
    it('уведомляет подписчиков и обновляет данные для поздних getInitialData', async () => {
        const instance = connect();
        emulateParentMessage({ id: APP_ID, action: 'init', data: INITIAL_DATA });

        const handler = vi.fn();
        instance.onDataUpdate(handler);

        const updated: TInitialData = {
            ...INITIAL_DATA,
            public: { ...INITIAL_DATA.public, userEmail: 'new@example.com' },
        };
        emulateParentMessage({ id: APP_ID, action: 'updateData', data: updated });

        expect(handler).toHaveBeenCalledWith(updated.public);
        await expect(instance.getInitialData()).resolves.toEqual(updated.public);
    });

    it('отписка работает', () => {
        const instance = connect();
        const handler = vi.fn();
        const unsubscribe = instance.onDataUpdate(handler);
        unsubscribe();
        emulateParentMessage({ id: APP_ID, action: 'updateData', data: INITIAL_DATA });
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('paymentResult', () => {
    it('доставляет статус подписчикам', () => {
        const instance = connect();
        const handler = vi.fn();
        instance.onPaymentResult(handler);
        emulateParentMessage({ id: APP_ID, action: 'paymentResult', data: 'completed' });
        expect(handler).toHaveBeenCalledWith('completed');
    });
});

describe('исходящие события', () => {
    it('height/done/checkout/link/error/unavailable уходят родителю с его origin', () => {
        const instance = connect();
        sentToParent = [];

        instance.onHeightChange(300);
        instance.onDone();
        instance.onCheckout('https://pay.example.com/order/1');
        instance.onLink('https://docs.example.com');
        instance.onError('boom');
        instance.onUnavailable();

        expect(sentToParent.map(({ message }) => (message as { action: string }).action)).toEqual([
            'height',
            'done',
            'checkout',
            'link',
            'error',
            'unavailable',
        ]);
        expect(new Set(sentToParent.map(({ targetOrigin }) => targetOrigin))).toEqual(
            new Set([PARENT_ORIGIN]),
        );
    });

    it('в RN WebView шлёт JSON-строку через ReactNativeWebView.postMessage', () => {
        const rnPostMessage = vi.fn();
        (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
            postMessage: rnPostMessage,
        };
        const instance = connect();
        rnPostMessage.mockClear();
        instance.onHeightChange(200);
        expect(rnPostMessage).toHaveBeenCalledWith(
            JSON.stringify({ id: APP_ID, action: 'height', data: 200 }),
        );
    });

    it('вне connect бросает понятную ошибку', () => {
        app = createMinapp({ parentOrigin: PARENT_ORIGIN });
        expect(() => app?.onHeightChange(100)).toThrow('not connected');
    });
});

describe('данные родительского заказа', () => {
    it('getBasketItems отдаёт позиции корзины; пусто, если хост не передал', async () => {
        const instance = connect();
        emulateParentMessage({
            id: APP_ID,
            action: 'init',
            data: {
                ...INITIAL_DATA,
                private: {
                    ...INITIAL_DATA.private,
                    basketItems: [{ sku: 'AERO-1', name: 'Билет Аэроэкспресс' }],
                },
            },
        });
        await expect(instance.getBasketItems()).resolves.toEqual([
            { sku: 'AERO-1', name: 'Билет Аэроэкспресс' },
        ]);
    });

    it('getBasketItems без basketItems в данных — пустой массив', async () => {
        const instance = connect();
        emulateParentMessage({ id: APP_ID, action: 'init', data: INITIAL_DATA });
        await expect(instance.getBasketItems()).resolves.toEqual([]);
    });
});

describe('metaData-хелперы', () => {
    it('matchMetaDataValues ищет вглубь', async () => {
        const instance = connect();
        emulateParentMessage({ id: APP_ID, action: 'init', data: INITIAL_DATA });
        await expect(instance.matchMetaDataValues('iataCode', ['DME'])).resolves.toBe(true);
        await expect(instance.matchMetaDataValues('iataCode', ['LED'])).resolves.toBe(false);
    });

    it('getMetaDataValues собирает уникальные значения', async () => {
        const instance = connect();
        emulateParentMessage({ id: APP_ID, action: 'init', data: INITIAL_DATA });
        await expect(instance.getMetaDataValues('iataCode')).resolves.toEqual(['SVO', 'DME']);
    });
});
