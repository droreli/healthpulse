import { useState } from "react";

export default function AuthScreen({
  onLogin,
  onSignup,
  onResetPassword,
  loading,
  error
}: {
  onLogin: (username: string, password: string) => Promise<boolean>;
  onSignup: (username: string, password: string) => Promise<boolean>;
  onResetPassword: (username: string, password: string) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "reset">("signup");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const ok =
        mode === "login"
          ? await onLogin(username, password)
          : mode === "signup"
            ? await onSignup(username, password)
            : await onResetPassword(username, password);
      if (ok && mode === "signup") {
        setMode("login");
      }
      if (ok && mode === "reset") {
        setMode("login");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-grid">
        <section className="auth-hero">
          <div>
            <p className="auth-kicker">HealthPulse · V2</p>
            <h1 className="auth-title">
              A private health <em>reading room</em> for imports, recovery, and long-range patterns.
            </h1>
            <p className="auth-copy">
              Sign in to your own account-level dataset, upload Apple Health `export.zip` files from Settings, and keep
              the dashboard isolated to your data only.
            </p>
          </div>

          <div className="auth-feature-grid">
            <FeatureCard title="Separate accounts" body="Username + password login with isolated data storage." />
            <FeatureCard title="Manual imports" body="Use the Settings page after login to upload a fresh export.zip." />
            <FeatureCard title="Annotations" body="Track alcohol, travel, illness, and stress inside the same workbench." />
          </div>
        </section>

        <section className="auth-panel">
          <p className="auth-panel-kicker">
            {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
          </p>
          <h2 className="auth-panel-title">
            {mode === "login"
              ? "Welcome back"
              : mode === "signup"
                ? "Start a private workspace"
                : "Reset your password"}
          </h2>
          <p className="auth-panel-copy">
            {mode === "login"
              ? "Use the username you already created."
              : mode === "signup"
                ? "Choose a username and password. Your account gets its own data store."
                : "Enter your username and a new password. This will replace the old password."}
          </p>

          <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="sam"
              autoComplete="username"
            />
            <Field
              label={mode === "reset" ? "New password" : "Password"}
              value={password}
              onChange={setPassword}
              placeholder="Minimum 8 characters"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              type="password"
            />

            {error ? <p className="auth-error">{error}</p> : null}

            <button
              type="submit"
              disabled={submitting || loading}
              className="btn primary auth-submit"
            >
              {submitting
                ? "Working..."
                : mode === "login"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Reset password"}
            </button>
          </form>

          <div className="auth-switch-row">
            <span className="auth-switch-copy">
              {mode === "login"
                ? "Need an account?"
                : mode === "signup"
                  ? "Already have an account?"
                  : "Remembered your password?"}
            </span>
            <div className="auth-switch-actions">
              {mode === "login" ? (
                <button
                  type="button"
                  className="auth-link"
                  onClick={() => setMode("reset")}
                >
                  Forgot password?
                </button>
              ) : null}
              <button
                type="button"
                className="auth-link"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        className="auth-input"
      />
    </label>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="auth-feature">
      <p className="auth-feature-title">{title}</p>
      <p className="auth-feature-body">{body}</p>
    </div>
  );
}
