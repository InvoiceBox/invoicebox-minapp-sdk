# minapp-sdk

Пакет для общения миниприложения c платежной страницей и приложением Инвойсбокс.
Миниприложение добавляет новый заказ к существующему `orderContainer`.
Миниприложение встраивается на платежную страницу через `iframe`, а в приложение через `webview`.

### Установка

```
npm i @invoicebox/minapp-sdk
```

### Создание экземпляра

```
import { InvoiceboxMinapp } from '@invoicebox/minapp-sdk';

const invoiceboxMinapp = new InvoiceboxMinapp()
```

### connect & disconnect

Общение между родительской страницей и миниприложением осуществляется через `window.postMessage()`. Чтобы начать слушать сообщения нужно вызвать `invoiceboxMinapp.connect()`, чтобы перестать слушать `invoiceboxMinapp.disconnect()`.

```
useEffect(() => {
    invoiceboxMinapp.connect();
    return () => {
        invoiceboxMinapp.disconnect();
    };
}, [invoiceboxMinapp]);
```

### onHeightChange

Для управления высотой миниприложения на платежной странице используется метод `onHeightChange`.
Миниприложение может задать высоту, которая требуется для корректного отображения миниприложения на платежной странице.

```
const Conatiner = ({ isConnected, children }: { isConnected: boolean, children: ReactNode }) => {
    const [elRef, setElRef] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!elRef) return;
        if (!isConnected) return;
        const observer = new ResizeObserver(() => {
            invoiceboxMinapp.onHeightChange(elRef.offsetHeight);
        });
        observer.observe(elRef);
        return () => observer.disconnect();
    }, [elRef, child, isConnected]);

    return <div ref={elRef}>{children}</div>;
}
```

### getInitialData

Чтобы получить данные, необходимые для создания заказа, существует метод `getInitialData`

```
invoiceboxMinapp.getInitialData().then(console.log);

/*
{
    orderContainerId: 'asd';
    userEmail: 'email@example.com';
    userName: 'Иван Иванов';
    userPhone: '+12345678910';
}
*/
```

### onDone

После того, как миниприложение успешно добавило новый заказ в существующий `orderContainer`, необходимо вызвать метод `onDone`.

```
 createOrderRequest(someData)
    .then(() => {
        invoiceboxMinapp.onDone();
    })
```

### onError

В случае возникновения ошибки в миниприложении, можно вызвать метод `onError`. Тогда родительская страница уведомит пользователя, что произошла ошибка. Функция принимает один опциональный строковый аргумент - пользовательское сообщение. Если сообщение есть, то оно отобразится. Если нет, то отобразится сообщение по умолчанию `Что-то пошло не так`.

```
invoiceboxMinapp.onError('Ошибка создания заказа'); // пользователь увидит "Ошибка создания заказа"
invoiceboxMinapp.onError(); // пользователь увидит "Что-то пошло не так"
```

### onLink

Метод `onLink` позволяет окрыть ссылку, как будто ссылка нажата не в контексте `iframe`/`webview`, а в контексте родительской страницы.

```
invoiceboxMinapp.onLink('https://www.google.com`); // на платежной странице будет открыта новая вкладка с googlе страницей, это никак не повлияет на миниприложение
```
