import {
    AppShell,
    Burger,
    Group,
    NavLink as MantineNavLink,
    Title,
    ActionIcon,
    useMantineColorScheme,
    useComputedColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
    IconSun,
    IconMoon,
    IconBuildingStore,
    IconPackage,
    IconTruck,
    IconReceipt2,
} from "@tabler/icons-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const NAV_ITEMS = [
    { to: "/products", label: "Товары", Icon: IconPackage },
    { to: "/suppliers", label: "Цены поставщиков", Icon: IconTruck },
    { to: "/expenses", label: "Расходы", Icon: IconReceipt2 },
    { to: "/marketplaces", label: "Маркетплейсы", Icon: IconBuildingStore },
];

export function AppShellLayout() {
    const [opened, { toggle }] = useDisclosure();
    const { setColorScheme } = useMantineColorScheme();
    const computedColorScheme = useComputedColorScheme("light", {
        getInitialValueInEffect: true,
    });
    const location = useLocation();

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: 260,
                breakpoint: "sm",
                collapsed: { mobile: !opened },
            }}
            padding="md"
        >
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Group>
                        <Burger
                            opened={opened}
                            onClick={toggle}
                            hiddenFrom="sm"
                            size="sm"
                        />
                        <Title order={4}>Ценообразование маркетплейсов</Title>
                    </Group>
                    <ActionIcon
                        variant="default"
                        size="lg"
                        onClick={() =>
                            setColorScheme(
                                computedColorScheme === "light"
                                    ? "dark"
                                    : "light",
                            )
                        }
                        aria-label="Переключить тему"
                    >
                        {computedColorScheme === "light" ? (
                            <IconMoon size={18} />
                        ) : (
                            <IconSun size={18} />
                        )}
                    </ActionIcon>
                </Group>
            </AppShell.Header>

            <AppShell.Navbar p="md">
                {NAV_ITEMS.map(({ to, label, Icon }) => (
                    <MantineNavLink
                        key={to}
                        component={NavLink}
                        to={to}
                        label={label}
                        leftSection={<Icon size={18} />}
                        active={location.pathname.startsWith(to)}
                        onClick={opened ? toggle : undefined}
                    />
                ))}
            </AppShell.Navbar>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}
