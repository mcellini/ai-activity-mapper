import { useState } from "react";
import type { Activity } from "@/types";
import { TEAMS, fmt, quadrant, teamById } from "@/lib/calc";

const W = 720;
const H = 520;
const M = { l: 64, r: 24, t: 24, b: 60 };
const x = (v: number) => M.l + (v / 100) * (W - M.l - M.r);
const y = (v: number) => H - M.b - (v / 100) * (H - M.t - M.b);

export default function MatrixView({ activities }: { activities: Activity[] }) {
  const [hover, setHover] = useState<Activity | null>(null);
  const maxH = Math.max(1, ...activities.map((a) => a.hoursManual));
  const r = (h: number) => 8 + Math.sqrt(h / maxH) * 22;
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="card p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* quadranti */}
          <rect x={x(0)} y={y(100)} width={x(50) - x(0)} height={y(50) - y(100)} fill="#f0f9ff" />
          <rect x={x(50)} y={y(100)} width={x(100) - x(50)} height={y(50) - y(100)} fill="#ecfdf5" />
          <rect x={x(0)} y={y(50)} width={x(50) - x(0)} height={y(0) - y(50)} fill="#f8fafc" />
          <rect x={x(50)} y={y(50)} width={x(100) - x(50)} height={y(0) - y(50)} fill="#f0fdf4" />
          <g fontSize="12" fontWeight="600" fill="#94a3b8" letterSpacing="0.04em">
            <text x={x(2)} y={y(97)}>AUGMENTED</text>
            <text x={x(98)} y={y(97)} textAnchor="end">FULL AI</text>
            <text x={x(2)} y={y(3)}>HUMAN CORE</text>
            <text x={x(98)} y={y(3)} textAnchor="end">AUTOMATE</text>
          </g>
          {/* assi */}
          {ticks.map((t) => (
            <g key={t} fontSize="11" fill="#64748b">
              <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(100)} stroke="#e2e8f0" />
              <line x1={x(0)} x2={x(100)} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
              <text x={x(t)} y={y(0) + 16} textAnchor="middle">{t}%</text>
              <text x={x(0) - 8} y={y(t) + 4} textAnchor="end">{t}%</text>
            </g>
          ))}
          <line x1={x(50)} x2={x(50)} y1={y(0)} y2={y(100)} stroke="#94a3b8" strokeDasharray="4 4" />
          <line x1={x(0)} x2={x(100)} y1={y(50)} y2={y(50)} stroke="#94a3b8" strokeDasharray="4 4" />
          <text x={(x(0) + x(100)) / 2} y={H - 18} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155">
            % Automatizzabile
          </text>
          <text transform={`translate(16 ${(y(0) + y(100)) / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fontWeight="600" fill="#334155">
            % Aumentabile
          </text>
          {/* bolle */}
          {[...activities].sort((a, b) => b.hoursManual - a.hoursManual).map((a) => (
            <circle
              key={a.id}
              cx={x(a.pctAutomatable)}
              cy={y(a.pctAugmentable)}
              r={r(a.hoursManual)}
              fill={teamById(a.teamId).color}
              fillOpacity={hover && hover.id !== a.id ? 0.2 : 0.65}
              stroke="#fff"
              strokeWidth={1.5}
              onMouseEnter={() => setHover(a)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <div className="label">Team</div>
          <ul className="space-y-1.5 text-sm">
            {TEAMS.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                {t.name}
              </li>
            ))}
          </ul>
          <div className="label mt-4">Dimensione bolla</div>
          <p className="text-xs text-slate-500">Ore manuali al mese (max {fmt(maxH)} h)</p>
        </div>
        <div className="card min-h-[120px] p-4 text-sm">
          {hover ? (
            <>
              <div className="font-semibold">{hover.name}</div>
              <div className="text-xs text-slate-500">{teamById(hover.teamId).name} · {quadrant(hover)}</div>
              <div className="mt-2 text-xs">
                {fmt(hover.hoursManual)} h/mese · Auto {hover.pctAutomatable}% · Aug {hover.pctAugmentable}%
              </div>
            </>
          ) : (
            <span className="text-slate-400">Passa il mouse su una bolla per i dettagli.</span>
          )}
        </div>
      </div>
    </div>
  );
}
