// ======== НАСТРОЙКИ ========
const CONFIG = {
  sheetName: "Лист1",
  articleColumn: 2,          // Колонка B — артикулы
  resultColumn: 4,           // Колонка D — ссылки
  startRow: 3,               // Данные начинаются с 3 строки
  yandexToken: "y0__xDN5YwEGJbsNyDY65uXEy3Pm5bl_ARWtk0ykwTVHRWcWMYr",
  yandexBaseFolder: "Avito",
  requestDelay: 2500,
  urlShortenerEndpoint: "https://clck.ru/--",
  logSheetName: "Лог",      // Название листа для логов
  skipFilledRows: true       // true = пропускать строки, где ссылка уже есть
};
// ===========================

// Создаёт меню в Google Таблице при открытии
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📷 Яндекс.Диск")
    .addItem("▶ Запустить сейчас (только пустые)", "runOnlyEmpty")
    .addItem("🔄 Перезапустить всё (включая заполненные)", "runAll")
    .addSeparator()
    .addItem("⏰ Включить автозапуск (каждый день в 9:00)", "setupDailyTrigger")
    .addItem("❌ Отключить автозапуск", "removeTriggers")
    .addToUi();
}

// Запуск только для пустых строк (основной режим)
function runOnlyEmpty() {
  importYandexLinks(true);
}

// Принудительный перезапуск всех строк
function runAll() {
  importYandexLinks(false);
}

// Автозапуск по триггеру (запускает только пустые)
function runAuto() {
  importYandexLinks(true);
}

// Установить ежедневный триггер в 9:00
function setupDailyTrigger() {
  removeTriggers(); // Удаляем старые, чтобы не дублировались
  ScriptApp.newTrigger("runAuto")
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
  SpreadsheetApp.getUi().alert("✅ Автозапуск настроен: каждый день в 9:00");
}

// Удалить все триггеры
function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  SpreadsheetApp.getUi().alert("❌ Автозапуск отключён");
}

// Сокращение ссылки
function shortenUrl(longUrl) {
  if (!longUrl) return null;
  try {
    const response = UrlFetchApp.fetch(CONFIG.urlShortenerEndpoint, {
      method: "POST",
      payload: { url: longUrl },
      muteHttpExceptions: true
    });
    return response.getResponseCode() === 200 ? response.getContentText() : longUrl;
  } catch (e) {
    return longUrl;
  }
}

// Получить или создать лист логов
function getOrCreateLogSheet(ss) {
  let logSheet = ss.getSheetByName(CONFIG.logSheetName);
  if (!logSheet) {
    logSheet = ss.insertSheet(CONFIG.logSheetName);
    logSheet.appendRow(["Дата и время", "Режим", "Обработано", "Обновлено", "Ошибок", "Пропущено"]);
    logSheet.getRange(1, 1, 1, 6).setFontWeight("bold");
  }
  return logSheet;
}

// Основная функция
function importYandexLinks(skipFilled) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.sheetName);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(`Лист '${CONFIG.sheetName}' не найден!`);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.startRow) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Нет данных для обработки", "Статус");
    return;
  }

  const data = sheet.getRange(CONFIG.startRow, 1, lastRow - CONFIG.startRow + 1, CONFIG.resultColumn).getValues();

  let processed = 0, updated = 0, errors = 0, skipped = 0;
  const mode = skipFilled ? "Только пустые" : "Все строки";

  data.forEach((row, index) => {
    const rowNum = index + CONFIG.startRow;
    const article = row[CONFIG.articleColumn - 1];
    const currentValue = row[CONFIG.resultColumn - 1];

    // Пропуск строк без артикула
    if (!article) {
      skipped++;
      return;
    }

    // Пропуск уже заполненных строк (если режим "только пустые")
    if (skipFilled && currentValue && !String(currentValue).startsWith("Ошибка")) {
      skipped++;
      return;
    }

    processed++;

    try {
      const fullPath = `${CONFIG.yandexBaseFolder}/${article}`;
      const encodedPath = encodeURIComponent(fullPath);

      const response = UrlFetchApp.fetch(
        `https://cloud-api.yandex.net/v1/disk/resources?path=${encodedPath}&limit=100`,
        {
          headers: { "Authorization": "OAuth " + CONFIG.yandexToken },
          muteHttpExceptions: true
        }
      );

      const responseData = JSON.parse(response.getContentText());

      if (response.getResponseCode() === 200) {
        const items = responseData._embedded?.items || [];
        const files = items.filter(item => item.type === "file");

        if (files.length > 0) {
          const links = files.map(file => shortenUrl(file.public_url || file.file)).filter(Boolean);
          sheet.getRange(rowNum, CONFIG.resultColumn).setValue(links.join(" "));
          updated++;
        } else {
          sheet.getRange(rowNum, CONFIG.resultColumn).setValue("Папка пуста");
          errors++;
        }
      } else {
        const errorMsg = responseData.description || "Ошибка запроса";
        sheet.getRange(rowNum, CONFIG.resultColumn).setValue(`Ошибка: ${errorMsg}`);
        errors++;
      }
    } catch (e) {
      sheet.getRange(rowNum, CONFIG.resultColumn).setValue(`Ошибка: ${e.message}`);
      errors++;
    }

    Utilities.sleep(CONFIG.requestDelay);
  });

  // Запись в лог
  const logSheet = getOrCreateLogSheet(ss);
  logSheet.appendRow([
    new Date(),
    mode,
    processed,
    updated,
    errors,
    skipped
  ]);

  ss.toast(`✅ Готово: обновлено ${updated}, ошибок ${errors}, пропущено ${skipped}`, "Статус", 10);
}
