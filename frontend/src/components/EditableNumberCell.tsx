import { useEffect, useState } from "react";
import { Loader, NumberInput } from "@mantine/core";

export function EditableNumberCell({ value, onCommit }: { value: number; onCommit: (value: number) => Promise<unknown> | void }) {
  const [local, setLocal] = useState<number | string>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  async function handleBlur() {
    const num = Number(local) || 0;
    if (num === value) return;
    setSaving(true);
    try {
      await onCommit(num);
    } finally {
      setSaving(false);
    }
  }

  return (
    <NumberInput
      size="xs"
      value={local}
      onChange={setLocal}
      onBlur={handleBlur}
      decimalScale={4}
      hideControls
      w={110}
      rightSection={saving ? <Loader size={12} /> : null}
    />
  );
}
