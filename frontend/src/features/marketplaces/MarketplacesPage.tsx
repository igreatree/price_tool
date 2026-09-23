import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ActionIcon, Button, Card, Center, Group, Loader, Modal, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { marketplacesApi } from "../../api/marketplaces";
import type { Marketplace } from "../../types";
import { MarketplaceForm } from "./MarketplaceForm";

export function MarketplacesPage() {
  const queryClient = useQueryClient();
  const { data: marketplaces, isLoading } = useQuery({ queryKey: ["marketplaces"], queryFn: marketplacesApi.list });
  const [opened, setOpened] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleDelete(e: React.MouseEvent, marketplace: Marketplace) {
    e.stopPropagation();
    if (!confirm(`Удалить маркетплейс "${marketplace.name}" вместе с его правилами и расчётами?`)) return;
    setDeletingId(marketplace.id);
    try {
      await marketplacesApi.remove(marketplace.id);
      await queryClient.invalidateQueries({ queryKey: ["marketplaces"] });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Маркетплейсы</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
          Добавить маркетплейс
        </Button>
      </Group>

      {isLoading && (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {(marketplaces ?? []).map((m) => (
          <Card key={m.id} withBorder padding="lg" onClick={() => navigate(`/marketplaces/${m.id}`)} style={{ cursor: "pointer" }}>
            <Group justify="space-between" mb="xs">
              <Text fw={600}>{m.name}</Text>
              <ActionIcon
                variant="subtle"
                color="red"
                loading={deletingId === m.id}
                onClick={(e) => handleDelete(e, m)}
                aria-label="Удалить"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
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
          onSaved={async () => {
            setOpened(false);
            notifications.show({ message: "Маркетплейс создан", color: "green" });
            await queryClient.invalidateQueries({ queryKey: ["marketplaces"] });
          }}
        />
      </Modal>
    </Stack>
  );
}
