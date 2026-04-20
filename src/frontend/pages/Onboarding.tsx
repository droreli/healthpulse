import AppleImportPanel from "../components/AppleImportPanel";
import { useNavigate } from "react-router-dom";

export default function Onboarding() {
  const navigate = useNavigate();
  const steps = [
    "On iPhone, open Health app, tap your avatar, then choose Export All Health Data.",
    "Share the resulting export.zip to your Mac.",
    "Open HealthPulse and use the Import Apple Health export.zip button here on the Onboarding tab.",
    "Wait for the initial import to finish. The first run imports your full history.",
    "When you export again later, import the new full export.zip and HealthPulse will reconcile only recent changes.",
    "Keep repeating that manual export cycle whenever you want to refresh the app."
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.22em] text-text-secondary">Onboarding</p>
        <h2 className="mt-2 text-4xl font-semibold text-white">HAE setup for HealthPulse</h2>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <ol className="space-y-4">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-4 rounded-2xl bg-black/20 p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-medium text-white">
                {index + 1}
              </span>
              <span className="pt-1 text-text-secondary">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <AppleImportPanel onImported={async () => navigate("/")} />
      </section>

      <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <h3 className="text-lg font-medium text-white">Import behavior</h3>
        <div className="mt-4 space-y-3 text-sm text-text-secondary">
          <p>The first import loads your full history from Apple Health.</p>
          <p>Later imports use a reconciliation window so only new and recently changed records are updated.</p>
        </div>
      </section>
    </div>
  );
}
