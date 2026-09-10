import { Textarea, type TextareaProps } from "@mantine/core";
import { validateExpression } from "../engine/expression";

interface Props extends Omit<TextareaProps, "error" | "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

export function ExpressionInput({ value, onChange, ...rest }: Props) {
  const error = validateExpression(value);
  return <Textarea value={value} onChange={(e) => onChange(e.currentTarget.value)} error={error} autosize minRows={1} {...rest} />;
}
