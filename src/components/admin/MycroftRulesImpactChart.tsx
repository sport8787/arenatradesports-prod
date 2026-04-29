import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface RankingItem {
  rule: string;
  field: string;
  op: string;
  category: "pontuacao" | "veto";
  hits_div: number;
  impacto_pct: number;
}

interface Props {
  ranking: RankingItem[];
}

/**
 * Mostra:
 *  1) Barras: impacto agregado por FIELD (top 12)
 *  2) Heatmap: FIELD × OPERADOR colorido por impacto total
 */
export function MycroftRulesImpactChart({ ranking }: Props) {
  const byField = useMemo(() => {
    const map = new Map<string, { field: string; impacto: number; hits_div: number; veto: number; pontos: number }>();
    for (const r of ranking) {
      const e = map.get(r.field) ?? { field: r.field, impacto: 0, hits_div: 0, veto: 0, pontos: 0 };
      e.impacto += r.impacto_pct;
      e.hits_div += r.hits_div;
      if (r.category === "veto") e.veto += r.impacto_pct;
      else e.pontos += r.impacto_pct;
      map.set(r.field, e);
    }
    return Array.from(map.values())
      .sort((a, b) => b.impacto - a.impacto)
      .slice(0, 12)
      .map((x) => ({ ...x, impacto: +x.impacto.toFixed(1), veto: +x.veto.toFixed(1), pontos: +x.pontos.toFixed(1) }));
  }, [ranking]);

  const heatmap = useMemo(() => {
    const fieldSet = new Set<string>();
    const opSet = new Set<string>();
    const cellMap = new Map<string, number>(); // key: field|op -> impacto
    for (const r of ranking) {
      fieldSet.add(r.field);
      opSet.add(r.op);
      const k = `${r.field}|${r.op}`;
      cellMap.set(k, (cellMap.get(k) ?? 0) + r.impacto_pct);
    }
    const fields = Array.from(fieldSet).sort();
    const ops = Array.from(opSet).sort();
    let max = 0;
    cellMap.forEach((v) => { if (v > max) max = v; });
    return { fields, ops, cellMap, max };
  }, [ranking]);

  if (ranking.length === 0) {
    return (
      <div className="border rounded-lg p-4 text-center text-xs text-muted-foreground">
        Sem dados para gerar gráficos. Rode uma simulação primeiro.
      </div>
    );
  }

  const barColor = (veto: number, pontos: number) =>
    veto > pontos ? "hsl(var(--destructive))" : "hsl(var(--primary))";

  const heatColor = (v: number) => {
    if (v <= 0 || heatmap.max <= 0) return "hsl(var(--muted) / 0.3)";
    const intensity = Math.min(1, v / heatmap.max);
    // gradiente de muted -> destructive
    return `hsl(0 84% ${60 - intensity * 25}% / ${0.25 + intensity * 0.65})`;
  };

  return (
    <div className="space-y-6">
      {/* BARRAS POR FIELD */}
      <div className="border rounded-lg p-3">
        <div className="mb-2">
          <h4 className="text-sm font-semibold">Impacto agregado por campo (top 12)</h4>
          <p className="text-[11px] text-muted-foreground">
            Soma do % de impacto de todas as regras divergentes por <code>field</code>. Vermelho = predomínio de regras de veto.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={byField} margin={{ top: 5, right: 5, left: -10, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="field"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              angle={-35}
              textAnchor="end"
              interval={0}
              height={70}
            />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(value: number, name: string, props: any) => {
                const p = props.payload;
                return [`${value}% (veto ${p.veto}% · pts ${p.pontos}% · ${p.hits_div} hits)`, "Impacto"];
              }}
            />
            <Bar dataKey="impacto" radius={[4, 4, 0, 0]}>
              {byField.map((d, i) => (
                <Cell key={i} fill={barColor(d.veto, d.pontos)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* HEATMAP FIELD × OPERADOR */}
      <div className="border rounded-lg p-3">
        <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="text-sm font-semibold">Heatmap — Campo × Operador</h4>
            <p className="text-[11px] text-muted-foreground">
              Soma de impacto% por combinação. Quanto mais vermelho, mais essa dimensão influencia divergências.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>0%</span>
            <div className="h-3 w-32 rounded" style={{ background: "linear-gradient(to right, hsl(var(--muted) / 0.3), hsl(0 84% 35% / 0.9))" }} />
            <span>{heatmap.max.toFixed(1)}%</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="text-[11px] border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground sticky left-0 bg-background pr-2">field \ op</th>
                {heatmap.ops.map((op) => (
                  <th key={op} className="font-mono px-2 text-muted-foreground">{op}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmap.fields.map((f) => (
                <tr key={f}>
                  <td className="font-mono pr-2 sticky left-0 bg-background">{f}</td>
                  {heatmap.ops.map((op) => {
                    const v = heatmap.cellMap.get(`${f}|${op}`) ?? 0;
                    return (
                      <td
                        key={op}
                        className="text-center rounded font-mono"
                        style={{
                          background: heatColor(v),
                          minWidth: 52,
                          height: 28,
                          color: v / (heatmap.max || 1) > 0.5 ? "hsl(var(--destructive-foreground))" : "hsl(var(--foreground))",
                        }}
                        title={`${f} ${op}: ${v.toFixed(1)}%`}
                      >
                        {v > 0 ? v.toFixed(0) : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
