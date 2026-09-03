# @invoicebox/minapp-sdk

SDK для мини-приложений Invoicebox: общение с хостом — платёжной страницей (iframe)
или мобильным приложением (React Native WebView).

- [Подробнее о мини-приложениях](https://docs.invoicebox.ru/docs/marketplace/mini-apps)
- [Схема взаимодействия](https://docs.invoicebox.ru/docs/marketplace/mini-apps/schema/)
- [Документация MiniApp SDK](https://docs.invoicebox.ru/docs/marketplace/mini-apps/miniapp-sdk/)

## Установка

```bash
npm i @invoicebox/minapp-sdk
```

## Быстрый старт

```ts
import { createMinapp } from '@invoicebox/minapp-sdk';

const minapp = createMinapp();

minapp.connect();

// данные от хоста (email/имя/телефон пользователя, locale, metaData и т.д.)
const initialData = await minapp.getInitialData();

// хост прислал обновлённые данные (пользователь изменил email на платёжной странице)
const unsubscribe = minapp.onDataUpdate((data) => {
    /* обновить состояние формы */
});

// контент изменил высоту — сообщаем хосту, он подгонит iframe
minapp.onHeightChange(newHeight);

// заказ создан, инициируем оплату
minapp.onCheckout(paymentUrl);
minapp.onPaymentResult((status) => {
    /* 'pending' | 'completed' | 'canceled' | 'expired' | 'hold' | 'unknown' */
});

// при размонтировании
minapp.disconnect();
```

В React создавайте экземпляр в браузерном коде (например, в `useEffect` или модуле,
который гарантированно исполняется в браузере) — конструктор требует `window`.

## API

| Метод | Назначение |
| --- | --- |
| `createMinapp(options?)` | Создать экземпляр. `options.parentOrigin` — origin хоста (по умолчанию из `document.referrer`), `options.initTimeoutMs` — таймаут ожидания init (15000) |
| `connect()` / `disconnect()` | Подписка/отписка на сообщения хоста. Идемпотентны. `connect` шлёт init с ретраями до ответа хоста |
| `getInitialData()` | Promise с публичными данными инициализации; reject по таймауту |
| `onDataUpdate(handler)` | Подписка на обновление данных от хоста (протокол v2). Возвращает функцию отписки |
| `onPaymentResult(handler)` | Подписка на статус оплаты после `onCheckout`. Возвращает функцию отписки |
| `onHeightChange(px)` | Сообщить хосту новую высоту контента |
| `onDone(paymentUrl?)` | Заказ добавлен (суборлер-флоу без внешней оплаты) |
| `onCheckout(paymentUrl)` | Инициировать оплату: хост откроет платёжную страницу по ссылке |
| `onLink(href)` | Попросить хост открыть ссылку в новой вкладке |
| `onError(message?)` | Сообщить об ошибке (хост покажет уведомление) |
| `onUnavailable()` | Услуга неприменима к заказу — хост скроет мини-апп |
| `matchMetaDataValues(key, values)` | Есть ли в metaData свойство `key` с одним из значений (поиск вглубь) |
| `getMetaDataValues(key \| keys[])` | Собрать значения свойств `key` из metaData (уникальные) |

## Протокол

Типы сообщений и версия протокола — в сабпате `@invoicebox/minapp-sdk/protocol`
(единственный источник правды, его же использует библиотека хоста
`@invoicebox/minapp-parent`). Текущая версия — 2: добавлено сообщение `updateData`
(хост обновляет данные без пересоздания iframe). SDK объявляет свою версию в
init-сообщении; хосты со старым протоколом просто не шлют `updateData`.

## Безопасность

- Входящие сообщения фильтруются по origin: принимаются только от origin хоста
  (по умолчанию — origin из `document.referrer`) и собственного origin страницы
  (так доставляет сообщения RN WebView). При необходимости задайте
  `options.parentOrigin` явно.
- Исходящие сообщения адресуются конкретному origin хоста, не `*`.

## Миграция с v4

- `invoiceboxMinapp` (синглтон, создававшийся при импорте) устарел: используйте
  `createMinapp()`. Обёртка `invoiceboxMinapp` пока работает (создаёт экземпляр
  лениво) и будет удалена в v6.
- `connect()`/`disconnect()` теперь идемпотентны (не бросают при повторном вызове).
- `getInitialData()` реджектится по таймауту, если хост не ответил (раньше «висла» вечно).
- `onPaymentResult` возвращает функцию отписки и поддерживает несколько подписчиков.
- `getParentOrigin()` удалён: в кросс-origin iframe он всегда бросал исключение.

## Разработка

```bash
npm ci
npm test          # vitest
npm run lint      # eslint + prettier
npm run typecheck
npm run build     # tsup -> dist/ (ESM + CJS + d.ts)
```

Релиз: поднять версию в `package.json`, запушить тег `vX.Y.Z` — GitHub Actions
опубликует пакет в npm (секрет `NPM_TOKEN`). Подробнее — RELEASE.md.
