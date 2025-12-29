// Пример использования множественного отслеживания каналов

// 1. Добавить каналы для отслеживания
async function addChannels() {
  const channels = [' ',' ',' ']; // Замените на реальные имена каналов
  
  for (const channelName of channels) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADD_MULTI_CHANNEL',
        channelName: channelName,
        config: {
          refreshInterval: 30000,      // Обновление каждые 30 секунд
          requestInterval: 5000,       // Запрос списка зрителей каждые 5 секунд
          timeoutDuration: 300000,     // Таймаут 5 минут
          batchSize: 20,               // Размер батча для запросов
          concurrentUserInfoBatches: 50 // Количество параллельных батчей
        }
      });
      
      console.log(`Канал ${channelName}:`, response);
    } catch (error) {
      console.error(`Ошибка при добавлении канала ${channelName}:`, error);
    }
  }
}

// 2. Включить автоматический запуск отслеживания
async function enableAutoStart() {
  const response = await chrome.runtime.sendMessage({
    type: 'SET_AUTO_START_ENABLED',
    enabled: true
  });
  
  console.log('Автозапуск включен:', response);
}

// 3. Включить автоматическую запись в CSV
async function enableCSVExport() {
  const response = await chrome.runtime.sendMessage({
    type: 'ENABLE_CSV_EXPORT',
    config: {
      writeIntervalMs: 60000,        // Записывать каждую минуту
      outputDirectory: 'twitch_viewer_data'
    }
  });
  
  console.log('CSV экспорт включен:', response);
}

// 4. Запустить отслеживание всех каналов
async function startAllChannels() {
  const response = await chrome.runtime.sendMessage({
    type: 'START_ALL_CHANNELS'
  });
  
  console.log('Запуск всех каналов:', response);
}

// 5. Получить статус всех каналов
async function getStatus() {
  const response = await chrome.runtime.sendMessage({
    type: 'GET_MULTI_CHANNEL_STATUS'
  });
  
  console.log('Статус каналов:', response);
  return response;
}

// 6. Экспортировать данные конкретного канала в CSV
async function exportChannel(channelName) {
  const response = await chrome.runtime.sendMessage({
    type: 'EXPORT_CHANNEL_TO_CSV',
    channelName: channelName
  });
  
  console.log(`Экспорт канала ${channelName}:`, response);
}

// Пример полной настройки
async function setupMultiChannelTracking() {
  console.log('Настройка множественного отслеживания...');
  
  // Добавить каналы
  await addChannels();
  
  // Включить автозапуск
  await enableAutoStart();
  
  // Включить CSV экспорт
  await enableCSVExport();
  
  // Запустить все каналы
  await startAllChannels();
  
  // Получить статус
  const status = await getStatus();
  
  console.log('Настройка завершена!', status);
}

// Запустить настройку
// setupMultiChannelTracking();

