import { useEffect, useState } from "react";
import { NumberInput } from "@mantine/core";

export function EditableNumberCell({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [local, setLocal] = useState<number | string>(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <NumberInput
      size="xs"
      value={local}
      onChange={setLocal}
      onBlur={() => {
        const num = Number(local) || 0;
        if (num !== value) onCommit(num);
      }}
      decimalScale={4}
      hideControls
      w={110}
    />
  );
}
