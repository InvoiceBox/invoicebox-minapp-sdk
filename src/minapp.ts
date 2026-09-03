import {
    PROTOCOL_VERSION,
    TBasketItemInfo,
    TChildToParentMessage,
    TInitialData,
    TPaymentStatus,
    TPublicInitialData,
    isParentToChildMessage,
} from './protocol/index';
import { deepEqual } from './deepEqual';

const INIT_RETRY_INTERVAL_MS = 500;
const DEFAULT_INIT_TIMEOUT_MS = 15000;

export type TMinappOptions = {
    /**
     * Origin родителя для проверки входящих сообщений и адресации исходящих.
     * По умолчанию берётся из document.referrer (origin страницы, встроившей iframe).
     * Сообщения из RN WebView приходят с origin самого мини-аппа — он разрешён всегда.
     */
    parentOrigin?: string;
    /** Таймаут ожидания init-ответа родителя, мс (по умолчанию 15000). */
    initTimeoutMs?: number;
};

type TDeferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
};

const createDeferred = <T>(): TDeferred<T> => {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const getReferrerOrigin = (): string | null => {
    if (!document.referrer) return null;
    try {
        return new URL(document.referrer).origin;
    } catch {
        return null;
    }
};

export class InvoiceboxMinapp {
    private id: string | null;

    private parentOrigin: string | null;

    private initTimeoutMs: number;

    private connected = false;

    private initialData: TInitialData | null = null;

    private initialDataDeferred: TDeferred<TInitialData> | null = null;

    private dataUpdateHandlers = new Set<(data: TPublicInitialData) => void>();

    private paymentResultHandlers = new Set<(status: TPaymentStatus) => void>();

    private initRetryTimer: number | null = null;

    private initTimeoutTimer: number | null = null;

    private hasWarnedNoTargetOrigin = false;

    private messageFromBound = this.messageFrom.bind(this);

    constructor(options: TMinappOptions = {}) {
        if (typeof window === 'undefined') {
            throw new Error(
                'InvoiceboxMinapp requires a browser environment: create the instance in browser-only code (e.g. inside useEffect), not at module top level.',
            );
        }

        this.id = new URL(window.location.href).searchParams.get('id');
        this.parentOrigin = options.parentOrigin ?? getReferrerOrigin();
        this.initTimeoutMs = options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
    }

    /** Идемпотентно: повторный вызов (например, из-за StrictMode) — no-op. */
    connect(): void {
        if (this.connected) return;

        if (!this.id) {
            console.warn(
                '[minapp-sdk] missing "id" query parameter: the app is not embedded by a host (opened directly?). Messages will not be delivered.',
            );
        }

        this.connected = true;
        window.addEventListener('message', this.messageFromBound);
        this.sendInitWithRetry();
    }

    /** Идемпотентно. Отменяет ожидания, сбрасывает полученные данные. */
    disconnect(): void {
        if (!this.connected) return;
        this.connected = false;

        this.stopInitRetry();
        this.stopInitTimeout();
        window.removeEventListener('message', this.messageFromBound);

        this.initialDataDeferred?.reject(new Error('Disconnected'));
        this.initialDataDeferred = null;
        this.initialData = null;
        this.dataUpdateHandlers.clear();
        this.paymentResultHandlers.clear();
    }

    isConnected(): boolean {
        return this.connected;
    }

    /**
     * Публичные данные инициализации от родителя. Reject: по таймауту
     * (родитель не ответил) или при disconnect.
     */
    getInitialData(): Promise<TPublicInitialData> {
        return this.getAllInitialData().then((initialData) => initialData.public);
    }

    /**
     * Подписка на updateData (протокол v2): родитель прислал свежие данные
     * (например, пользователь изменил email на платёжной странице).
     * Возвращает функцию отписки.
     */
    onDataUpdate(handler: (data: TPublicInitialData) => void): () => void {
        this.dataUpdateHandlers.add(handler);
        return () => this.dataUpdateHandlers.delete(handler);
    }

    /** Подписка на статус оплаты (после checkout). Возвращает функцию отписки. */
    onPaymentResult(handler: (status: TPaymentStatus) => void): () => void {
        this.paymentResultHandlers.add(handler);
        return () => this.paymentResultHandlers.delete(handler);
    }

    onHeightChange(height: number): void {
        this.messageTo({ id: this.requireId(), action: 'height', data: height });
    }

    onDone(paymentUrl?: string | null): void {
        this.messageTo({ id: this.requireId(), action: 'done', data: paymentUrl ?? null });
    }

    onCheckout(paymentUrl: string): void {
        this.messageTo({ id: this.requireId(), action: 'checkout', data: paymentUrl });
    }

    onLink(href: string): void {
        this.messageTo({ id: this.requireId(), action: 'link', data: href });
    }

    onError(message?: string): void {
        this.messageTo({ id: this.requireId(), action: 'error', data: message || null });
    }

    onUnavailable(): void {
        this.messageTo({ id: this.requireId(), action: 'unavailable', data: null });
    }

    /** Есть ли в metaData свойство targetKey с одним из значений targetValues (поиск вглубь). */
    matchMetaDataValues(targetKey: string, targetValues: unknown[]): Promise<boolean> {
        return this.getAllInitialData().then(({ private: { metaData } }) =>
            this.matchSomeProperty(metaData, targetKey, targetValues),
        );
    }

    /**
     * Позиции корзины родительского заказа (артикул + наименование) — для матчинга
     * «услуга уже куплена на стороне мерчанта». Пустой массив, если хост их не передал.
     */
    getBasketItems(): Promise<TBasketItemInfo[]> {
        return this.getAllInitialData().then(({ private: privateData }) => privateData.basketItems ?? []);
    }

    /** Все значения свойств с именами targetKey из metaData (поиск вглубь, уникальные). */
    getMetaDataValues(targetKey: string | string[]): Promise<unknown[]> {
        return this.getAllInitialData().then(({ private: { metaData } }) => {
            const targetKeys = Array.isArray(targetKey) ? targetKey : [targetKey];
            const sourceValues: unknown[] = [];
            targetKeys.forEach((key) => this.collectProperties(metaData, key, sourceValues));
            return sourceValues.filter(
                (value, index) => sourceValues.findIndex((other) => deepEqual(value, other)) === index,
            );
        });
    }

    private getAllInitialData(): Promise<TInitialData> {
        if (this.initialData) return Promise.resolve(this.initialData);

        if (!this.initialDataDeferred) {
            this.initialDataDeferred = createDeferred<TInitialData>();
            this.startInitTimeout();
        }

        return this.initialDataDeferred.promise;
    }

    private requireId(): string {
        return this.id ?? '';
    }

    private sendInitWithRetry(): void {
        const send = () => {
            this.messageTo({ id: this.requireId(), action: 'init', version: PROTOCOL_VERSION });
        };
        send();
        // Родитель может подключить слушатель позже (гонка при прогретом iframe) —
        // повторяем init до его ответа; ответ останавливает ретраи.
        this.initRetryTimer = window.setInterval(send, INIT_RETRY_INTERVAL_MS);
    }

    private stopInitRetry(): void {
        if (this.initRetryTimer === null) return;
        window.clearInterval(this.initRetryTimer);
        this.initRetryTimer = null;
    }

    private startInitTimeout(): void {
        this.initTimeoutTimer = window.setTimeout(() => {
            const deferred = this.initialDataDeferred;
            this.initialDataDeferred = null;
            deferred?.reject(
                new Error(`[minapp-sdk] no init response from the host within ${this.initTimeoutMs}ms`),
            );
        }, this.initTimeoutMs);
    }

    private stopInitTimeout(): void {
        if (this.initTimeoutTimer === null) return;
        window.clearTimeout(this.initTimeoutTimer);
        this.initTimeoutTimer = null;
    }

    private isAllowedOrigin(origin: string): boolean {
        // Пустой origin бывает у синтетических событий (тесты, некоторые WebView).
        if (!origin) return true;
        // RN WebView: injectJavaScript исполняется в контексте страницы — origin свой.
        if (origin === window.location.origin) return true;
        if (this.parentOrigin && origin === this.parentOrigin) return true;
        // parentOrigin неизвестен (нет referrer и опции) — origin-фильтр деградирует
        // до проверки id; сузьте referrerpolicy хоста или передайте options.parentOrigin.
        return this.parentOrigin === null;
    }

    private messageFrom(event: MessageEvent): void {
        if (!this.isAllowedOrigin(event.origin)) return;

        const data: unknown = event.data;
        if (!isParentToChildMessage(data)) return;
        if (data.id !== this.id) return;

        if (data.action === 'init') {
            this.stopInitRetry();
            this.stopInitTimeout();
            this.initialData = data.data;
            this.initialDataDeferred?.resolve(data.data);
            this.initialDataDeferred = null;
        }

        if (data.action === 'updateData') {
            this.initialData = data.data;
            this.dataUpdateHandlers.forEach((handler) => handler(data.data.public));
        }

        if (data.action === 'paymentResult') {
            this.paymentResultHandlers.forEach((handler) => handler(data.data));
        }
    }

    private messageTo(message: TChildToParentMessage): void {
        if (!this.connected) throw new Error('[minapp-sdk] not connected: call connect() first');

        const globalWindow = window as unknown as {
            ReactNativeWebView?: { postMessage: (message: string) => void };
        };

        if (globalWindow.ReactNativeWebView) {
            globalWindow.ReactNativeWebView.postMessage(JSON.stringify(message));
            return;
        }

        if (window.parent === window) return;

        if (!this.parentOrigin && !this.hasWarnedNoTargetOrigin) {
            this.hasWarnedNoTargetOrigin = true;
            console.warn(
                '[minapp-sdk] parent origin is unknown (no referrer): falling back to targetOrigin "*". Pass options.parentOrigin or relax the host referrerpolicy.',
            );
        }

        window.parent.postMessage(message, this.parentOrigin ?? '*');
    }

    private matchSomeProperty(struct: unknown, targetKey: string, targetValues: unknown[]): boolean {
        if (typeof struct !== 'object' || struct === null) return false;

        return Object.entries(struct).some(([sourceKey, sourceValue]) => {
            const isMatch =
                sourceKey === targetKey &&
                targetValues.some((targetValue) => deepEqual(targetValue, sourceValue));
            return isMatch || this.matchSomeProperty(sourceValue, targetKey, targetValues);
        });
    }

    private collectProperties(struct: unknown, targetKey: string, sourceValues: unknown[]): void {
        if (typeof struct !== 'object' || struct === null) return;

        Object.entries(struct).forEach(([sourceKey, sourceValue]) => {
            if (sourceKey === targetKey) sourceValues.push(sourceValue);
            this.collectProperties(sourceValue, targetKey, sourceValues);
        });
    }
}

/** Создать экземпляр SDK. Вызывать в браузерном коде (не на верхнем уровне модуля при SSR). */
export const createMinapp = (options?: TMinappOptions): InvoiceboxMinapp => new InvoiceboxMinapp(options);
