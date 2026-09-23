import { Textarea, type TextareaProps } from "@mantine/core";

interface Props extends Omit<TextareaProps, "error" | "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

/** Только проверка синтаксиса (скрипт не выполняется) — new Function компилирует тело функции,
 * не запуская его, и бросает SyntaxError при некорректном JS. */
function validateScript(script: string): string | null {
  if (!script.trim()) return null;
  try {
    // eslint-disable-next-line no-new-func -- только проверка синтаксиса, скрипт не выполняется
    new Function(script);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Аналог ExpressionInput для полей с JS-скриптом (startPriceScript/priceFormulaScript/actionScript). */
export function ScriptInput({ value, onChange, ...rest }: Props) {
  const error = validateScript(value);
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      error={error}
      autosize
      minRows={3}
      styles={{ input: { fontFamily: "monospace" } }}
      {...rest}
    />
  );
}
