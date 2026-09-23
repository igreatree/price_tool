// Единый формат для экспорта/импорта правил через Excel/Google Sheets — колонки должны совпадать
// на обеих сторонах, иначе импорт не найдёт нужные поля при обратной загрузке файла.
export const RULE_SHEET_COLUMNS = {
  name: "Название",
  priority: "Приоритет",
  enabled: "Активно",
  condition: "Условие",
  actionScript: "Скрипт действия",
  isFinal: "Финальное",
} as const;
