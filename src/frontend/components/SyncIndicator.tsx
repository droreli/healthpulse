import type { SyncStatusPayload } from "../lib/contracts";

export default function SyncIndicator({ sync }: { sync: SyncStatusPayload }) {
  const color =
    sync.status === "healthy"
      ? "bg-emerald-400"
      : sync.status === "stale"
        ? "bg-amber-400"
        : sync.status === "missing"
          ? "bg-red-400"
          : "bg-slate-400";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        <div>
          <p className="text-sm font-medium text-white">
            {sync.lastSyncedAt
              ? `${sync.mode === "apple_xml_manual" ? "Last import" : "Last synced"} ${new Date(sync.lastSyncedAt).toLocaleString()}`
              : "Waiting for first import"}
          </p>
          <p className="text-xs text-text-secondary">
            {sync.mode === "apple_xml_manual"
              ? sync.issues[0] ?? `${sync.processedFiles} Apple Health export(s) processed`
              : sync.issues[0] ?? `${sync.processedFiles} file(s) processed`}
          </p>
        </div>
      </div>
    </div>
  );
}
