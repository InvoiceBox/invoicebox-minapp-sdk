import isEqual from 'lodash.isequal';

type TInitMessageTo = {
    id: string;
    action: 'init';
};

type THeightMessageTo = {
    id: string;
    action: 'height';
    data: number;
};

type TDoneMessageTo = {
    id: string;
    action: 'done';
    data: string;
};

type TErrorMessageTo = {
    id: string;
    action: 'error';
    data: string | null;
};

type TLinkMessageTo = {
    id: string;
    action: 'link';
    data: string;
};

type TUnavailableMessageTo = {
    id: string;
    action: 'unavailable';
    data: null;
};

type TOrderMinapp = {
    orderContainerId?: never;
    minappType: 'order';
};

type TSuborderMinapp = {
    orderContainerId: string;
    minappType: 'suborder';
};

type TInitMessageFrom = {
    id: string;
    action: 'init';
    data: {
        public: {
            shopId?: number;
            userEmail: string;
            userName: string;
            userPhone: string;
        } & (TOrderMinapp | TSuborderMinapp);
        private: {
            metaData: unknown[];
        };
    };
};

export class InvoiceboxMinapp {
    private id: string;

    private initialDataPromiseResolvers: ((initialData: TInitMessageFrom['data']['public']) => void)[] = [];

    private initailData: TInitMessageFrom['data'] | null = null;

    constructor() {
        const url = new URL(window.location.href);
        this.id = url.searchParams.get('id') as string;
        window.addEventListener('message', this.messageFrom.bind(this));
        this.messageTo({ id: this.id, action: 'init' });
    }

    private messageFrom(originalEvent: Event) {
        const event = originalEvent as MessageEvent;
        try {
            const data = event.data as TInitMessageFrom;
            if (data.id !== this.id) return;

            if (data.action === 'init') {
                this.initialDataPromiseResolvers.forEach((resolver) => resolver(data.data.public));
                this.initialDataPromiseResolvers = [];
                this.initailData = data.data;
            }
        } catch (err) {
            // do nothing
        }
    }

    private messageTo(
        message:
            | TInitMessageTo
            | THeightMessageTo
            | TDoneMessageTo
            | TLinkMessageTo
            | TErrorMessageTo
            | TUnavailableMessageTo,
    ) {
        const parentWindow = window as unknown as {
            ReactNativeWebView?: { postMessage: (message: string) => void };
            parent: { postMessage: (message: unknown, options: '*') => void };
        };

        if (parentWindow.ReactNativeWebView) {
            parentWindow.ReactNativeWebView.postMessage(JSON.stringify(message));
            return;
        }

        if (parentWindow.parent === window) return;

        parentWindow.parent.postMessage(message, '*');
    }

    onHeightChange(height: number) {
        this.messageTo({ id: this.id, action: 'height', data: height });
    }

    getInitialData(): Promise<TInitMessageFrom['data']['public']> {
        if (this.initailData) return Promise.resolve(this.initailData.public);

        return new Promise((resolve) => {
            this.initialDataPromiseResolvers.push(resolve);
        });
    }

    onDone(paymentUrl: string) {
        this.messageTo({ id: this.id, action: 'done', data: paymentUrl });
    }

    onLink(href: string) {
        this.messageTo({ id: this.id, action: 'link', data: href });
    }

    onError(message?: string) {
        this.messageTo({ id: this.id, action: 'error', data: message || null });
    }

    onUnavailable() {
        this.messageTo({ id: this.id, action: 'unavailable', data: null });
    }

    getParentOrigin() {
        return window.parent.location.origin;
    }

    private matchSomeProperty(struct: unknown, targetKey: string, targetValues: unknown[]) {
        if (typeof struct !== 'object' || struct === null) return false;

        for (const sourceKey in struct) {
            const sourceValue = struct[sourceKey as keyof typeof struct] as unknown;

            const isMatch =
                targetKey === sourceKey &&
                targetValues.some((targetValue) => isEqual(targetValue, sourceValue));

            if (isMatch) return true;

            const isDeepMatch = this.matchSomeProperty(sourceValue, targetKey, targetValues);

            if (isDeepMatch) return true;
        }

        return false;
    }

    matchSomeMetaData(targetKey: string, targetValues: unknown[]): boolean {
        if (!this.initailData) return false;

        const { metaData } = this.initailData.private;

        return this.matchSomeProperty(metaData, targetKey, targetValues);
    }
}
