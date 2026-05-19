import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import type { LiveSessionState } from '@/lib/blackjack/live/liveTypes';

interface Props { state: LiveSessionState }

export default function SessionHistory({ state }: Props) {
  const greens = state.history.filter(r => r.result === 'win' || r.result === 'blackjack').length;
  const reds = state.history.filter(r => r.result === 'loss').length;
  const pushes = state.history.filter(r => r.result === 'push').length;
  const total = state.history.length;
  const profit = state.bankroll - state.config.initialBankroll;
  const tcAvg = state.count.history.length
    ? (state.count.history.reduce((a, b) => a + b, 0) / state.count.history.length).toFixed(2)
    : '0.00';

  const chartData = [
    { round: 0, bankroll: state.config.initialBankroll },
    ...state.history.map(r => ({ round: r.id, bankroll: r.bankrollAfter })),
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Histórico da sessão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Rodadas</p>
            <p className="font-bold text-lg">{total}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">P&amp;L</p>
            <p className={`font-bold text-lg ${profit >= 0 ? 'text-green-400' : 'text-destructive'}`}>
              {profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)}
            </p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">TC médio</p>
            <p className="font-bold text-lg">{tcAvg}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Badge className="bg-green-500/20 text-green-300 border-green-500/40">G {greens}</Badge>
          <Badge className="bg-destructive/20 text-destructive border-destructive/40">R {reds}</Badge>
          <Badge variant="outline">P {pushes}</Badge>
          <Badge variant="outline">Shuffles {state.shuffles.length}</Badge>
          <Badge variant="outline">Banca R$ {state.bankroll.toFixed(2)}</Badge>
        </div>

        {chartData.length > 1 && (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="round" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Line type="monotone" dataKey="bankroll" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
