import { useEffect, useState } from 'react';

interface Stats {
  status: string;
  visits: {
    daily: Record<string, number>;
    monthly: Record<string, number>;
  };
  current: {
    messages: number;
    rooms: number;
    connections: number;
  };
  uptime: number;
}

const HTTP_URL =
  import.meta.env.VITE_HTTP_URL ||
  'https://oneminute-backend-jvip.onrender.com';

function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${HTTP_URL}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');

      const data: Stats = await res.json();
      setStats(data);
    } catch (err) {
      setError('Unable to load server stats');
    } finally {
      setLoading(false);
    }
  };

  // Fetch once when panel opens
  useEffect(() => {
    if (open && !stats) {
      fetchStats();
    }
  }, [open]);

  // Auto refresh every 30s while open
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [open]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const monthKey = new Date().toISOString().slice(0, 7);

  const todayVisits = stats?.visits.daily[todayKey] ?? 0;
  const monthVisits = stats?.visits.monthly[monthKey] ?? 0;

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="border-t border-white/10 bg-black/20">
      <div className="max-w-4xl mx-auto px-4">
        {/* Toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full py-2 flex items-center justify-center gap-2 text-xs text-white/60 hover:text-white/90 transition"
        >
          <span>{open ? 'Hide Server Stats' : 'Show Server Stats'}</span>
          <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>

        {open && (
          <div className="pb-4">
            {loading && !stats && (
              <div className="text-center text-white/50 py-6">
                Loading stats…
              </div>
            )}

            {error && (
              <div className="text-center text-red-400 py-4 text-sm">
                {error}
              </div>
            )}

            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Stat label="Online Users" value={stats.current.connections} />
                <Stat label="Active Rooms" value={stats.current.rooms} />
                <Stat label="Messages" value={stats.current.messages} />
                <Stat label="Visits Today" value={todayVisits} />
                <Stat label="Visits This Month" value={monthVisits} />
                <Stat label="Uptime" value={formatUptime(stats.uptime)} />
              </div>
            )}

            {stats && (
              <div className="text-center mt-3">
                <button
                  onClick={fetchStats}
                  disabled={loading}
                  className="text-xs text-white/50 hover:text-white/80"
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default StatsPanel;
