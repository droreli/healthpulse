import { useSyncStatus } from "../hooks/useSyncStatus";
import { useAuth } from "../hooks/useAuth";

export default function Settings() {
  const { data, loading, error } = useSyncStatus();
  const auth = useAuth();

  if (loading || auth.loading) return <div className="text-text-secondary">Loading settings…</div>;
  if (error || !data) return <div className="text-red-300">Failed to load settings: {error}</div>;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Settings</p>
        <h2 className="mt-2 text-4xl font-semibold text-white">Local configuration and sync health</h2>
        <p className="mt-3 text-sm text-text-secondary">Signed in as {auth.user?.username ?? "unknown"}.</p>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-medium text-white">Manual import mode</h3>
        <div className="mt-4 space-y-3 text-sm">
          <PathRow label="Data source mode" value={data.mode} />
          <PathRow label="Last import" value={data.lastSyncedAt ?? "No Apple Health export imported yet"} />
        </div>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-medium text-white">MVP defaults</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <ValueCard label="Max heart rate" value="179 bpm" />
          <ValueCard label="Zone 2 band" value="60-70%" />
          <ValueCard label="Sleep goal" value="7.5 hours" />
          <ValueCard label="Data store" value="One SQLite file per account" />
        </div>
      </section>
    </div>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-2 break-all text-white">{value}</p>
    </div>
  );
}

function ValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">{label}</p>
      <p className="mt-2 text-xl font-medium text-white">{value}</p>
    </div>
  );
}
