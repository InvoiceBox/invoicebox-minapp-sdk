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

type TInitMessageFrom = {
    id: string;
    action: 'init';
    data: {
        orderContainerId?: string;
        userEmail: string;
        userName: string;
        userPhone: string;
    };
};

export class InvoiceboxMinapp {
    private id: string;

    private messageFromEventListener = this.messageFrom.bind(this);

    private initialDataPromiseResolvers: ((initialData: TInitMessageFrom['data']) => void)[] = [];

    private initailData: TInitMessageFrom['data'] | null = null;

    constructor() {
        const url = new URL(window.location.href);
        this.id = url.searchParams.get('id') as string;
    }

    connect() {
        window.addEventListener('message', this.messageFromEventListener);
        this.messageTo({ id: this.id, action: 'init' });
    }

    disconnect() {
        window.removeEventListener('message', this.messageFromEventListener);
    }

    private messageFrom(originalEvent: Event) {
        const event = originalEvent as MessageEvent;
        try {
            const data = event.data as TInitMessageFrom;
            if (data.id !== this.id) return;

            if (data.action === 'init') {
                this.initialDataPromiseResolvers.forEach((resolver) => resolver(data.data));
                this.initialDataPromiseResolvers = [];
                this.initailData = data.data;
            }
        } catch (err) {
            // do nothing
        }
    }

    private messageTo(
        message: TInitMessageTo | THeightMessageTo | TDoneMessageTo | TLinkMessageTo | TErrorMessageTo,
    ) {
        window.parent.postMessage(message, '*');
    }

    onHeightChange(height: number) {
        this.messageTo({ id: this.id, action: 'height', data: height });
    }

    getInitialData(): Promise<TInitMessageFrom['data']> {
        if (this.initailData) return Promise.resolve(this.initailData);

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

    getParentOrigin() {
        return window.parent.location.origin;
    }
}
