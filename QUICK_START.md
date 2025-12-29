# Быстрый старт: Множественное отслеживание каналов

## Минимальная настройка (3 шага)

### 1. Откройте консоль браузера (F12)

### 2. Добавьте каналы для отслеживания

```javascript
// Замените на реальные имена каналов
const channels = ['channel1', 'channel2', 'channel3'];

channels.forEach(channel => {
  chrome.runtime.sendMessage({
    type: 'ADD_MULTI_CHANNEL',
    channelName: channel
  });
});
```

### 3. Включите автозапуск и CSV экспорт

```javascript
// Включить автозапуск
chrome.runtime.sendMessage({
  type: 'SET_AUTO_START_ENABLED',
  enabled: true
});

// Включить автоматическую запись в CSV (каждую минуту)
chrome.runtime.sendMessage({
  type: 'ENABLE_CSV_EXPORT',
  config: {
    enabled: true,
    writeIntervalMs: 60000  // 1 минута
  }
});
```

## Проверка статуса

```javascript
chrome.runtime.sendMessage({
  type: 'GET_MULTI_CHANNEL_STATUS'
}, (response) => {
  console.table(response.status);
});
```

## Где найти CSV файлы?

Файлы сохраняются в папку загрузок браузера:
- `twitch_viewer_data/{channelName}_{дата}_{время}.csv` - данные зрителей
- `twitch_viewer_data/{channelName}_history_{дата}_{время}.csv` - история количества зрителей

## Остановка

```javascript
// Остановить все каналы
chrome.runtime.sendMessage({ type: 'STOP_ALL_CHANNELS' });

// Выключить CSV экспорт
chrome.runtime.sendMessage({ type: 'DISABLE_CSV_EXPORT' });
```

Подробная документация: см. `MULTI_CHANNEL_GUIDE.md`

