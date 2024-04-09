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
    isHeightByParent: true;
};

type TSuborderMinapp = {
    orderContainerId: string;
    minappType: 'suborder';
    isHeightByParent: false;
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

class InvoiceboxMinapp {
    private id: string;

    private initialDataPromiseResolvers: ((initialData: TInitMessageFrom['data']) => void)[] = [];
    private initialDataPromiseRejectors: ((error: Error) => void)[] = [];

    private initailData: TInitMessageFrom['data'] | null = null;

    private messageFromBinded = this.messageFrom.bind(this);

    private connected = false;

    constructor() {
        const url = new URL(window.location.href);
        this.id = url.searchParams.get('id') as string;
    }

    connect() {
        if (this.connected) throw new Error('Already connected');
        this.connected = true;
        window.addEventListener('message', this.messageFromBinded);
        this.messageTo({ id: this.id, action: 'init' });
    }

    disconnect() {
        if (!this.connected) throw new Error('Already disconnected');
        this.connected = false;
        this.initailData = null;
        this.initialDataPromiseResolvers = [];
        this.initialDataPromiseRejectors.forEach((rejector) => rejector(new Error('Disconnected')));
        this.initialDataPromiseRejectors = [];
        window.removeEventListener('message', this.messageFromBinded);
    }

    isConnected() {
        return this.connected;
    }

    private messageFrom(originalEvent: Event) {
        const event = originalEvent as MessageEvent;
        try {
            const data = event.data as TInitMessageFrom;
            if (data.id !== this.id) return;

            if (data.action === 'init') {
                this.initialDataPromiseResolvers.forEach((resolver) => resolver(data.data));
                this.initialDataPromiseResolvers = [];
                this.initialDataPromiseRejectors = [];
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
        if (!this.connected) throw new Error('not connected');

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

    private getAllInitialData(): Promise<TInitMessageFrom['data']> {
        if (this.initailData) return Promise.resolve(this.initailData);

        return new Promise((resolve, reject) => {
            this.initialDataPromiseResolvers.push(resolve);
            this.initialDataPromiseRejectors.push(reject);
        });
    }

    getInitialData(): Promise<TInitMessageFrom['data']['public']> {
        return this.getAllInitialData().then((initialData) => initialData.public);
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

    matchSomeMetaData(targetKey: string, targetValues: unknown[]): Promise<boolean> {
        return this.getAllInitialData().then((initialData) => {
            const { metaData } = initialData.private;
            return this.matchSomeProperty(metaData, targetKey, targetValues);
        });
    }
}

export const invoiceboxMinapp = new InvoiceboxMinapp();
