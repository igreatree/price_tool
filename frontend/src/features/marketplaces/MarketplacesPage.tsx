import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { ActionIcon, Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { db } from "../../db/db";
import type { Marketplace } from "../../types";
import { MarketplaceForm } from "./MarketplaceForm";
import { recalcMarketplace } from "../../engine/recalcService";

export function MarketplacesPage() {
  const marketplaces = useLiveQuery(() => db.marketplaces.toArray(), []);
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();

  async function handleDelete(e: React.MouseEvent, marketplace: Marketplace) {
    e.stopPropagation();
    if (!confirm(`Удалить маркетплейс "${marketplace.name}" вместе с его правилами и расчётами?`)) return;
    await db.marketplaces.delete(marketplace.id);
    await db.rules.where("marketplaceId").equals(marketplace.id).delete();
    await db.marketplaceProductParams.where("marketplaceId").equals(marketplace.id).delete();
    await db.calculatedPrices.where("marketplaceId").equals(marketplace.id).delete();
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Маркетплейсы</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          Добавить маркетплейс
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {(marketplaces ?? []).map((m) => (
          <Card key={m.id} withBorder padding="lg" onClick={() => navigate(`/marketplaces/${m.id}`)} style={{ cursor: "pointer" }}>
            <Group justify="space-between" mb="xs">
              <Text fw={600}>{m.name}</Text>
              <ActionIcon variant="subtle" color="red" onClick={(e) => handleDelete(e, m)} aria-label="Удалить">
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
            <Badge color={m.pricingMode === "direct" ? "gray" : "indigo"}>
              {m.pricingMode === "direct" ? "Прямая формула" : "Целевая маржа"}
            </Badge>
          </Card>
        ))}
      </SimpleGrid>

      {marketplaces && marketplaces.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          Маркетплейсов пока нет — добавьте первый (например, Ozon, Wildberries, Яндекс Маркет).
        </Text>
      )}

      <Modal opened={opened} onClose={() => setOpened(false)} title="Новый маркетплейс" size="lg">
        <MarketplaceForm
          marketplace={null}
          onSaved={async (marketplace) => {
            setOpened(false);
            notifications.show({ message: "Маркетплейс создан", color: "green" });
            await recalcMarketplace(marketplace);
          }}
        />
      </Modal>
    </Stack>
  );
}
