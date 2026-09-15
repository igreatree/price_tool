import {
    AppShell,
    Burger,
    Group,
    NavLink as MantineNavLink,
    Title,
    ActionIcon,
    useMantineColorScheme,
    useComputedColorScheme,
    Image,
} from "@mantine/core";
import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import {
    IconSun,
    IconMoon,
    IconBuildingStore,
    IconPackage,
    IconTruck,
    IconReceipt2,
    IconLogout,
} from "@tabler/icons-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import Logo from "../assets/logo.svg";

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
    const { username, logout } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);

    async function handleLogout() {
        setLoggingOut(true);
        try {
            await logout();
        } finally {
            setLoggingOut(false);
        }
    }

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
                        <Group gap={1}>
                            <Image w={80} src={Logo} />
                            <Title mb="4" order={2}>
                                .PRICE
                            </Title>
                        </Group>
                    </Group>
                    <Group gap="xs">
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
                        <ActionIcon
                            variant="default"
                            size="lg"
                            loading={loggingOut}
                            onClick={handleLogout}
                            aria-label={`Выйти (${username})`}
                            title={username ? `Выйти (${username})` : "Выйти"}
                        >
                            <IconLogout size={18} />
                        </ActionIcon>
                    </Group>
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
