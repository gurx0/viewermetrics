# Руководство по множественному отслеживанию каналов

## Обзор

Программа была модифицирована для поддержки автоматического отслеживания нескольких каналов Twitch одновременно с автоматической записью данных в CSV файлы.

## Основные возможности

1. **Множественное отслеживание**: Одновременное отслеживание неограниченного количества каналов
2. **Автоматическая запись в CSV**: Периодическое сохранение данных всех каналов в CSV файлы
3. **Управление через API**: Полный контроль через сообщения расширения

## Использование

### 1. Добавление каналов

Откройте консоль браузера (F12) и выполните:

```javascript
// Добавить один канал
chrome.runtime.sendMessage({
  type: 'ADD_MULTI_CHANNEL',
  channelName: 'имя_канала',
  config: {
    refreshInterval: 30000,      // Обновление каждые 30 секунд
    requestInterval: 5000,        // Запрос списка зрителей каждые 5 секунд
    timeoutDuration: 300000,      // Таймаут 5 минут
    batchSize: 20,                // Размер батча для запросов
    concurrentUserInfoBatches: 50 // Количество параллельных батчей
  }
}, (response) => {
  console.log('Результат:', response);
});
```

### 2. Добавление нескольких каналов

```javascript
const channels = ['channel1', 'channel2', 'channel3'];

channels.forEach(channelName => {
  chrome.runtime.sendMessage({
    type: 'ADD_MULTI_CHANNEL',
    channelName: channelName,
    config: {
      refreshInterval: 30000,
      requestInterval: 5000,
      timeoutDuration: 300000
    }
  });
});
```

### 3. Включение автоматического запуска

```javascript
chrome.runtime.sendMessage({
  type: 'SET_AUTO_START_ENABLED',
  enabled: true
}, (response) => {
  console.log('Автозапуск:', response);
});
```

### 4. Включение автоматической записи в CSV

```javascript
chrome.runtime.sendMessage({
  type: 'ENABLE_CSV_EXPORT',
  config: {
    writeIntervalMs: 60000,        // Записывать каждую минуту (в миллисекундах)
    outputDirectory: 'twitch_viewer_data' // Папка для сохранения
  }
}, (response) => {
  console.log('CSV экспорт:', response);
});
```

### 5. Запуск отслеживания всех каналов

```javascript
chrome.runtime.sendMessage({
  type: 'START_ALL_CHANNELS'
}, (response) => {
  console.log('Запуск каналов:', response);
});
```

### 6. Получение статуса

```javascript
chrome.runtime.sendMessage({
  type: 'GET_MULTI_CHANNEL_STATUS'
}, (response) => {
  console.log('Статус каналов:', response);
  // response.status содержит массив с информацией о каждом канале
});
```

### 7. Получение списка каналов

```javascript
chrome.runtime.sendMessage({
  type: 'GET_MULTI_CHANNELS'
}, (response) => {
  console.log('Список каналов:', response.channels);
});
```

### 8. Экспорт конкретного канала в CSV

```javascript
chrome.runtime.sendMessage({
  type: 'EXPORT_CHANNEL_TO_CSV',
  channelName: 'имя_канала'
}, (response) => {
  console.log('Экспорт:', response);
});
```

### 9. Управление каналами

```javascript
// Включить/выключить канал
chrome.runtime.sendMessage({
  type: 'SET_CHANNEL_ENABLED',
  channelName: 'имя_канала',
  enabled: true // или false
});

// Удалить канал
chrome.runtime.sendMessage({
  type: 'REMOVE_MULTI_CHANNEL',
  channelName: 'имя_канала'
});

// Остановить все каналы
chrome.runtime.sendMessage({
  type: 'STOP_ALL_CHANNELS'
});
```

## Формат CSV файлов

### Файл данных зрителей

Имя файла: `{channelName}_{дата}_{время}.csv`

Структура:
```csv
channel,username,id,display_name,created_at,description,first_seen,last_seen,time_in_stream_seconds,viewer_count,authenticated_count,timestamp
```

### Файл истории количества зрителей

Имя файла: `{channelName}_history_{дата}_{время}.csv`

Структура:
```csv
channel,timestamp,viewer_count,authenticated_count
```

## Полный пример настройки

```javascript
async function setupMultiChannelTracking() {
  // 1. Добавить каналы
  const channels = ['channel1', 'channel2', 'channel3'];
  
  for (const channelName of channels) {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        type: 'ADD_MULTI_CHANNEL',
        channelName: channelName,
        config: {
          refreshInterval: 30000,
          requestInterval: 5000,
          timeoutDuration: 300000
        }
      }, resolve);
    });
  }
  
  // 2. Включить автозапуск
  await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'SET_AUTO_START_ENABLED',
      enabled: true
    }, resolve);
  });
  
  // 3. Включить CSV экспорт (каждую минуту)
  await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'ENABLE_CSV_EXPORT',
      config: {
        writeIntervalMs: 60000,
        outputDirectory: 'twitch_viewer_data'
      }
    }, resolve);
  });
  
  // 4. Запустить все каналы
  await new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'START_ALL_CHANNELS'
    }, resolve);
  });
  
  console.log('Настройка завершена!');
}

// Запустить
setupMultiChannelTracking();
```

## Сохранение конфигурации

Все настройки автоматически сохраняются в `chrome.storage.local` и восстанавливаются при перезапуске расширения. Если включен автозапуск, все каналы начнут отслеживаться автоматически.

## Ограничения

- Rate limit API Twitch: 5000 запросов в минуту (общий для всех каналов)
- Файлы сохраняются в папку загрузок браузера
- Для работы требуется разрешение `downloads` в manifest.json (уже добавлено)

## Устранение неполадок

### CSV файлы не создаются

1. Проверьте, что включен CSV экспорт:
```javascript
chrome.runtime.sendMessage({
  type: 'ENABLE_CSV_EXPORT',
  config: { enabled: true }
});
```

### Каналы не отслеживаются

1. Проверьте статус:
```javascript
chrome.runtime.sendMessage({
  type: 'GET_MULTI_CHANNEL_STATUS'
}, (response) => console.log(response));
```

2. Убедитесь, что каналы добавлены и включены

3. Проверьте консоль на наличие ошибок

