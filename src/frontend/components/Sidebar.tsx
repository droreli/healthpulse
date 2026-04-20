import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Dashboard", icon: "🏠", end: true },
  { to: "/sleep", label: "Sleep", icon: "😴" },
  { to: "/workouts", label: "Workouts", icon: "🏃" },
  { to: "/heart", label: "Heart & Recovery", icon: "❤️" },
  { to: "/weekly-review", label: "Weekly Review", icon: "📋" },
  { to: "/onboarding", label: "Onboarding", icon: "🧭" },
  { to: "/settings", label: "Settings", icon: "⚙️" }
];

export default function Sidebar({
  username,
  onLogout
}: {
  username: string;
  onLogout: () => void;
}) {
  return (
    <aside className="sticky top-0 h-screen w-full max-w-64 border-r border-white/10 bg-black/20 px-4 py-6 backdrop-blur">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.32em] text-text-secondary">HealthPulse</p>
        <h1 className="mt-2 text-2xl font-semibold text-text-primary">Personal Health Workbench</h1>
      </div>

      <nav className="space-y-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            end={item.end}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                isActive ? "bg-white/12 text-white shadow-panel" : "text-text-secondary hover:bg-white/6 hover:text-white"
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-8">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text-secondary">Signed in as</p>
          <p className="mt-2 break-all text-sm font-medium text-white">{username}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-4 rounded-full border border-white/10 px-3 py-2 text-xs font-medium text-text-secondary transition hover:border-white/20 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
