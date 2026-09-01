/**
 * Протокол общения мини-аппа с хостом (платёжная страница — iframe,
 * мобильное приложение — WebView). Единственный источник правды о сообщениях:
 * родительская библиотека (@invoicebox/minapp-parent) импортирует типы отсюда
 * через сабпат `@invoicebox/minapp-sdk/protocol`.
 *
 * Версионирование: ребёнок объявляет свою версию протокола в init-сообщении.
 * Сообщения v1 не имели поля `version` — родитель обязан трактовать его
 * отсутствие как версию 1. Новые сообщения добавляются только с ростом версии;
 * обе стороны обязаны молча игнорировать неизвестные `action`.
 */

export const PROTOCOL_VERSION = 2;

/** Возможности, появившиеся в конкретных версиях протокола. */
export const PROTOCOL_FEATURES = {
    /** parent → child `updateData`: обновление данных без пересоздания iframe (v2+) */
    updateData: 2,
} as const;

export type TPaymentStatus = 'pending' | 'completed' | 'canceled' | 'expired' | 'hold' | 'unknown';

/** Мини-апп открыт мобильным приложением (WebView): самостоятельный заказ, полная высота. */
export type TAppSettings = {
    orderContainerId?: never;
    minappType: 'order';
    fullHeight: true;
};

/** Мини-апп открыт платёжной страницей (iframe): суборлер к существующему orderContainer. */
export type TWebSettings = {
    orderContainerId: string;
    minappType: 'suborder';
    fullHeight: false;
};

export type TPublicInitialData = {
    shopId: number;
    userEmail: string;
    userName: string;
    userPhone: string;
    locale: string;
} & (TWebSettings | TAppSettings);

export type TPrivateInitialData = {
    metaData: unknown[];
};

export type TInitialData = {
    public: TPublicInitialData;
    private: TPrivateInitialData;
};

// ─── Сообщения child → parent ───────────────────────────────────────────────

export type TInitMessageTo = {
    id: string;
    action: 'init';
    /** Версия протокола ребёнка; отсутствует в v1 */
    version?: number;
};

export type THeightMessageTo = {
    id: string;
    action: 'height';
    data: number;
};

export type TDoneMessageTo = {
    id: string;
    action: 'done';
    data: string | null;
};

export type TErrorMessageTo = {
    id: string;
    action: 'error';
    data: string | null;
};

export type TLinkMessageTo = {
    id: string;
    action: 'link';
    data: string;
};

export type TUnavailableMessageTo = {
    id: string;
    action: 'unavailable';
    data: null;
};

export type TCheckoutMessageTo = {
    id: string;
    action: 'checkout';
    data: string;
};

export type TChildToParentMessage =
    | TInitMessageTo
    | THeightMessageTo
    | TDoneMessageTo
    | TErrorMessageTo
    | TLinkMessageTo
    | TUnavailableMessageTo
    | TCheckoutMessageTo;

// ─── Сообщения parent → child ───────────────────────────────────────────────

export type TInitMessageFrom = {
    id: string;
    action: 'init';
    data: TInitialData;
};

/** v2+: обновление данных уже инициализированного мини-аппа (без пересоздания iframe). */
export type TUpdateDataMessageFrom = {
    id: string;
    action: 'updateData';
    data: TInitialData;
};

export type TPaymentResultMessageFrom = {
    id: string;
    action: 'paymentResult';
    data: TPaymentStatus;
};

export type TParentToChildMessage = TInitMessageFrom | TUpdateDataMessageFrom | TPaymentResultMessageFrom;

// ─── Рантайм-проверки ───────────────────────────────────────────────────────

const CHILD_TO_PARENT_ACTIONS = new Set([
    'init',
    'height',
    'done',
    'error',
    'link',
    'unavailable',
    'checkout',
]);
const PARENT_TO_CHILD_ACTIONS = new Set(['init', 'updateData', 'paymentResult']);

const isMessageShape = (value: unknown): value is { id: unknown; action: unknown } =>
    typeof value === 'object' && value !== null && 'id' in value && 'action' in value;

export const isChildToParentMessage = (value: unknown): value is TChildToParentMessage =>
    isMessageShape(value) &&
    typeof value.id === 'string' &&
    typeof value.action === 'string' &&
    CHILD_TO_PARENT_ACTIONS.has(value.action);

export const isParentToChildMessage = (value: unknown): value is TParentToChildMessage =>
    isMessageShape(value) &&
    typeof value.id === 'string' &&
    typeof value.action === 'string' &&
    PARENT_TO_CHILD_ACTIONS.has(value.action);

/** Версия протокола ребёнка по его init-сообщению (v1 не присылала поле `version`). */
export const getChildProtocolVersion = (initMessage: TInitMessageTo): number => initMessage.version ?? 1;

/** Поддерживает ли ребёнок возможность `feature` (по версии из его init-сообщения). */
export const isFeatureSupported = (
    feature: keyof typeof PROTOCOL_FEATURES,
    childProtocolVersion: number,
): boolean => childProtocolVersion >= PROTOCOL_FEATURES[feature];
