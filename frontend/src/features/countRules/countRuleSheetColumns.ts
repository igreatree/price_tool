// Единый формат для экспорта/импорта правил остатков через Excel/Google Sheets — колонки должны
// совпадать на обеих сторонах, иначе импорт не найдёт нужные поля при обратной загрузке файла.
export const COUNT_RULE_SHEET_COLUMNS = {
  name: "Название",
  priority: "Приоритет",
  enabled: "Активно",
  condition: "Условие",
  script: "Скрипт",
  isFinal: "Финальное",
} as const;
