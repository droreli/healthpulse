import AuthScreen from "./components/AuthScreen";
import { useAuth } from "./hooks/useAuth";
import WorkbenchApp from "./workbench/AppShell";

export default function App() {
  const auth = useAuth();

  if (auth.loading) {
    return <div className="flex min-h-screen items-center justify-center text-text-secondary">Loading account…</div>;
  }

  if (!auth.user) {
    return (
      <AuthScreen
        onLogin={auth.login}
        onSignup={auth.signup}
        onResetPassword={auth.resetPassword}
        loading={auth.loading}
        error={auth.error}
      />
    );
  }

  return <WorkbenchApp username={auth.user.username} onLogout={() => void auth.logout()} />;
}
