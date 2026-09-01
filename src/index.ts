export { InvoiceboxMinapp, createMinapp } from './minapp';
export type { TMinappOptions } from './minapp';

export * from './protocol/index';

import { InvoiceboxMinapp, createMinapp } from './minapp';
import type { TPaymentStatus, TPublicInitialData } from './protocol/index';

let legacyInstance: InvoiceboxMinapp | null = null;
const getLegacy = (): InvoiceboxMinapp => {
    legacyInstance ??= createMinapp();
    return legacyInstance;
};

/**
 * @deprecated Синглтон времён v4: создавался при импорте модуля и падал вне браузера.
 * Используйте createMinapp() в браузерном коде. Обёртка создаёт экземпляр лениво,
 * при первом обращении; будет удалена в v6.
 */
export const invoiceboxMinapp = {
    connect: () => getLegacy().connect(),
    disconnect: () => getLegacy().disconnect(),
    isConnected: () => getLegacy().isConnected(),
    getInitialData: () => getLegacy().getInitialData(),
    onDataUpdate: (handler: (data: TPublicInitialData) => void) => getLegacy().onDataUpdate(handler),
    onPaymentResult: (handler: (status: TPaymentStatus) => void) => getLegacy().onPaymentResult(handler),
    onHeightChange: (height: number) => getLegacy().onHeightChange(height),
    onDone: (paymentUrl?: string | null) => getLegacy().onDone(paymentUrl),
    onCheckout: (paymentUrl: string) => getLegacy().onCheckout(paymentUrl),
    onLink: (href: string) => getLegacy().onLink(href),
    onError: (message?: string) => getLegacy().onError(message),
    onUnavailable: () => getLegacy().onUnavailable(),
    matchMetaDataValues: (targetKey: string, targetValues: unknown[]) =>
        getLegacy().matchMetaDataValues(targetKey, targetValues),
    getMetaDataValues: (targetKey: string | string[]) => getLegacy().getMetaDataValues(targetKey),
};
