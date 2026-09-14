import { useState } from "react";
import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from "@mantine/core";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { ApiError } from "../../api/client";

export function LoginPage() {
  const { username: currentUsername, login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (currentUsername) {
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Center h="100vh">
      <Paper withBorder shadow="sm" p="xl" w={360}>
        <form onSubmit={handleSubmit}>
          <Stack>
            <Title order={3} ta="center">
              Вход
            </Title>
            {error && (
              <Alert color="red" variant="light">
                {error}
              </Alert>
            )}
            <TextInput label="Логин" required autoFocus value={username} onChange={(e) => setUsername(e.currentTarget.value)} />
            <PasswordInput label="Пароль" required value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
            <Button type="submit" loading={submitting} fullWidth>
              Войти
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
