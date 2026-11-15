import { useEffect, useMemo, useState } from "react";
import { Moon, Play, Square, Clock3, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { sleepRepository, analyzeSleep } from "../storage/userRepository";
import type { SleepLog } from "../types/user";

function fmtDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function fmtTime(ts: number): string {
  return ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

export function SleepTrackingPage() {
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [active, setActive] = useState<SleepLog | null>(null);
  const [tick, setTick] = useState(Date.now());

  const refresh = () => {
    setLogs(sleepRepository.getAll());
    setActive(sleepRepository.getActive());
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active]);

  const startSleep = () => {
    sleepRepository.start();
    refresh();
  };

  const stopSleep = () => {
    sleepRepository.stop();
    refresh();
  };

  const completed = useMemo(() => logs.filter((l) => l.endTime && l.durationMs > 0), [logs]);

  const chartData = useMemo(() => {
    return [...completed]
      .sort((a, b) => a.startTime - b.startTime)
      .slice(-14)
      .map((l) => ({
        label: new Date(l.startTime).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        hours: Math.round((l.durationMs / 3600000) * 100) / 100,
        day: l.day,
      }));
  }, [completed]);

  const latest = completed[0];
  const latestAnalysis = latest ? analyzeSleep(latest.durationMs) : null;
  const avgHours = completed.length
    ? Math.round((completed.reduce((s, l) => s + l.durationMs, 0) / completed.length / 3600000) * 10) / 10
    : null;

  const qualityColor = (hours: number) => {
    if (hours >= 7 && hours <= 9) return "#22c55e";
    if ((hours >= 6 && hours < 7) || (hours > 9 && hours <= 10)) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="min-h-[100svh] bg-[#07111f]/60 backdrop-blur-md text-white p-5 sm:p-8 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300">Health & recovery</p>
          <h1 className="mt-1 text-2xl font-semibold flex items-center gap-2"><Moon size={22} className="text-cyan-300" /> Sleep tracking</h1>
          <p className="mt-2 text-sm text-slate-400">Log sleep sessions and review duration trends. Recommended sleep for astronauts during missions is typically 7–9 hours per 24-hour period.</p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[#0d1b2b]/80 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{active ? "Sleep session in progress" : "Ready to track sleep"}</p>
              {active ? (
                <p className="mt-1 text-xs text-slate-400">Started {fmtTime(active.startTime)} · {active.day}, {active.date} · Elapsed {fmtDuration(tick - active.startTime)}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">Press Start sleep when you go to sleep and Stop sleep when you wake up.</p>
              )}
            </div>
            <div className="flex gap-2">
              {!active ? (
                <button onClick={startSleep} className="inline-flex items-center justify-center gap-2 min-h-[2.75rem] rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-bold text-slate-950 active:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition">
                  <Play size={16} /> Start sleep
                </button>
              ) : (
                <button onClick={stopSleep} className="inline-flex items-center justify-center gap-2 min-h-[2.75rem] rounded-lg bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 active:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 transition">
                  <Square size={16} /> Stop sleep
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#0d1b2b]/80 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Latest session</p>
            <p className="mt-1 text-xl font-semibold text-white">{latest ? fmtDuration(latest.durationMs) : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">{latest ? `${latest.day}, ${latest.date}` : "No completed sessions"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0d1b2b]/80 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Average duration</p>
            <p className="mt-1 text-xl font-semibold text-white">{avgHours != null ? `${avgHours}h` : "—"}</p>
            <p className="mt-1 text-xs text-slate-400">{completed.length} completed session{completed.length === 1 ? "" : "s"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0d1b2b]/80 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Sleep health</p>
            <p className={`mt-1 text-xl font-semibold ${latestAnalysis ? (latestAnalysis.quality === "Healthy" ? "text-emerald-300" : latestAnalysis.quality === "Borderline" ? "text-amber-300" : "text-rose-300") : "text-white"}`}>
              {latestAnalysis ? latestAnalysis.quality : "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">Based on latest session</p>
          </div>
        </section>

        {latestAnalysis && (
          <section className={`rounded-2xl border p-4 sm:p-5 ${latestAnalysis.quality === "Healthy" ? "border-emerald-300/20 bg-emerald-300/[0.06]" : latestAnalysis.quality === "Borderline" ? "border-amber-300/20 bg-amber-300/[0.06]" : "border-rose-300/20 bg-rose-300/[0.06]"}`}>
            <div className="flex items-start gap-3">
              <Activity size={18} className={latestAnalysis.quality === "Healthy" ? "text-emerald-300" : latestAnalysis.quality === "Borderline" ? "text-amber-300" : "text-rose-300"} />
              <div>
                <p className="text-sm font-semibold text-white">Analysis: {latestAnalysis.quality}</p>
                <p className="mt-1 text-sm text-slate-300 leading-6">{latestAnalysis.message}</p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-white/10 bg-[#0d1b2b]/80 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Sleep schedule</p>
              <h2 className="mt-1 text-lg font-semibold">Duration by session</h2>
            </div>
            <span className="text-[10px] text-slate-500">Target: 7–9 hours</span>
          </div>
          {chartData.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No completed sleep sessions yet. Start and stop a session to see your chart.</div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, "dataMax + 1"]} unit="h" />
                  <Tooltip contentStyle={{ background: "#0d1b2b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} formatter={(v) => [`${v} h`, "Duration"]} />
                  <ReferenceLine y={7} stroke="#22c55e" strokeDasharray="4 4" />
                  <ReferenceLine y={9} stroke="#22c55e" strokeDasharray="4 4" />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => <Cell key={i} fill={qualityColor(entry.hours)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0d1b2b]/80">
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Sleep log</p>
            <h2 className="mt-1 text-lg font-semibold">Recorded sessions</h2>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {completed.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-slate-500">No recorded sleep sessions.</div>
            ) : (
              completed.map((l) => {
                const a = analyzeSleep(l.durationMs);
                return (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="rounded-lg bg-cyan-300/[0.08] p-2.5 text-cyan-300"><Clock3 size={16} /></span>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{l.day}, {l.date}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">Start {fmtTime(l.startTime)} · Stop {fmtTime(l.endTime)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{fmtDuration(l.durationMs)}</p>
                      <p className={`mt-0.5 text-[10px] font-medium ${a.quality === "Healthy" ? "text-emerald-300" : a.quality === "Borderline" ? "text-amber-300" : "text-rose-300"}`}>{a.quality}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
