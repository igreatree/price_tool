import { useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Button, Group, Modal, Stack, Tabs, Title } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { db } from "../../db/db";
import { MarketplaceForm } from "./MarketplaceForm";
import { MarketplaceParamsTab } from "../marketplaceParams/MarketplaceParamsTab";
import { RulesTab } from "../rules/RulesTab";
import { CalculatedPricesTab } from "../prices/CalculatedPricesTab";

export function MarketplaceDetailPage() {
  const { marketplaceId } = useParams();
  const marketplace = useLiveQuery(
    () => (marketplaceId ? db.marketplaces.get(marketplaceId) : undefined),
    [marketplaceId],
  );
  const [editOpened, setEditOpened] = useState(false);

  if (!marketplace) return null;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>{marketplace.name}</Title>
        <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditOpened(true)}>
          Настройки маркетплейса
        </Button>
      </Group>

      <Tabs defaultValue="params" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="params">Параметры товаров</Tabs.Tab>
          <Tabs.Tab value="rules">Правила</Tabs.Tab>
          <Tabs.Tab value="prices">Расчёт цен</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="params" pt="md">
          <MarketplaceParamsTab marketplace={marketplace} />
        </Tabs.Panel>
        <Tabs.Panel value="rules" pt="md">
          <RulesTab marketplace={marketplace} />
        </Tabs.Panel>
        <Tabs.Panel value="prices" pt="md">
          <CalculatedPricesTab marketplace={marketplace} />
        </Tabs.Panel>
      </Tabs>

      <Modal opened={editOpened} onClose={() => setEditOpened(false)} title="Настройки маркетплейса" size="lg">
        <MarketplaceForm
          marketplace={marketplace}
          onSaved={() => {
            setEditOpened(false);
            notifications.show({
              message: "Настройки сохранены. Не забудьте нажать «Пересчитать всё» на вкладке «Расчёт цен».",
              color: "blue",
            });
          }}
        />
      </Modal>
    </Stack>
  );
}
