import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Trophy, Users, Swords, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const WIDGET_SCRIPT_URL = 'https://widgets.api-sports.io/3.1.0/widget.js';

export default function PunterWidgets() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch API key from edge function
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-widget-key', {});
        if (error) throw error;
        setApiKey(data?.key || null);
      } catch (err) {
        console.error('Error fetching widget key:', err);
        toast.error('Erro ao carregar widgets');
      } finally {
        setLoading(false);
      }
    };
    fetchKey();
  }, []);

  // Load widget script once we have the key
  useEffect(() => {
    if (!apiKey) return;

    // Check if script already loaded
    if (document.querySelector(`script[src="${WIDGET_SCRIPT_URL}"]`)) return;

    const script = document.createElement('script');
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.setAttribute('data-key', apiKey);
    script.setAttribute('data-theme', 'dark');
    script.setAttribute('data-lang', 'pt');
    document.body.appendChild(script);

    return () => {
      // Don't remove - widgets need it
    };
  }, [apiKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Widgets não disponíveis. Chave da API não configurada.</p>
            <Button onClick={() => navigate('/punter')} className="mt-4">Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/punter')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-success" />
              <h1 className="font-orbitron text-base md:text-lg font-bold text-primary">
                Widgets — Dados ao Vivo
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="games" className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              Jogos
            </TabsTrigger>
            <TabsTrigger value="standings" className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4" />
              Classificação
            </TabsTrigger>
            <TabsTrigger value="h2h" className="flex items-center gap-1.5">
              <Swords className="w-4 h-4" />
              H2H
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Times
            </TabsTrigger>
          </TabsList>

          {/* Games Widget */}
          <TabsContent value="games">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-orbitron">Jogos ao Vivo e Próximos</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="widget-container min-h-[500px]"
                  dangerouslySetInnerHTML={{
                    __html: `<div id="wg-api-football-games"
                      data-host="v3.football.api-sports.io"
                      data-key="${apiKey}"
                      data-date=""
                      data-league=""
                      data-season=""
                      data-theme="dark"
                      data-lang="pt"
                      data-show-toolbar="true"
                      data-show-errors="false"
                      data-show-logos="true"
                      data-modal-game="true"
                      data-modal-standings="true"
                      data-modal-show-498="true"
                      class="wg_loader">
                    </div>`
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Standings Widget */}
          <TabsContent value="standings">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-orbitron">Classificação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Brasileirão */}
                  <div>
                    <p className="text-sm font-bold text-foreground mb-2">🇧🇷 Brasileirão Série A</p>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: `<div id="wg-api-football-standings-71"
                          data-host="v3.football.api-sports.io"
                          data-key="${apiKey}"
                          data-league="71"
                          data-team=""
                          data-season=""
                          data-theme="dark"
                          data-lang="pt"
                          data-show-errors="false"
                          data-show-logos="true"
                          class="wg_loader">
                        </div>`
                      }}
                    />
                  </div>
                  {/* Paulistão */}
                  <div>
                    <p className="text-sm font-bold text-foreground mb-2">🏆 Paulistão</p>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: `<div id="wg-api-football-standings-475"
                          data-host="v3.football.api-sports.io"
                          data-key="${apiKey}"
                          data-league="475"
                          data-team=""
                          data-season=""
                          data-theme="dark"
                          data-lang="pt"
                          data-show-errors="false"
                          data-show-logos="true"
                          class="wg_loader">
                        </div>`
                      }}
                    />
                  </div>
                  {/* Carioca */}
                  <div>
                    <p className="text-sm font-bold text-foreground mb-2">🏆 Carioca</p>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: `<div id="wg-api-football-standings-476"
                          data-host="v3.football.api-sports.io"
                          data-key="${apiKey}"
                          data-league="476"
                          data-team=""
                          data-season=""
                          data-theme="dark"
                          data-lang="pt"
                          data-show-errors="false"
                          data-show-logos="true"
                          class="wg_loader">
                        </div>`
                      }}
                    />
                  </div>
                  {/* Premier League */}
                  <div>
                    <p className="text-sm font-bold text-foreground mb-2">🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League</p>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: `<div id="wg-api-football-standings-39"
                          data-host="v3.football.api-sports.io"
                          data-key="${apiKey}"
                          data-league="39"
                          data-team=""
                          data-season=""
                          data-theme="dark"
                          data-lang="pt"
                          data-show-errors="false"
                          data-show-logos="true"
                          class="wg_loader">
                        </div>`
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* H2H Widget */}
          <TabsContent value="h2h">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-orbitron">Confronto Direto (H2H)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Selecione um jogo na aba "Jogos" para ver o confronto direto entre os times.
                </p>
                <div
                  dangerouslySetInnerHTML={{
                    __html: `<div id="wg-api-football-games-h2h"
                      data-host="v3.football.api-sports.io"
                      data-key="${apiKey}"
                      data-date=""
                      data-league=""
                      data-season=""
                      data-theme="dark"
                      data-lang="pt"
                      data-show-toolbar="true"
                      data-show-errors="false"
                      data-show-logos="true"
                      data-modal-game="true"
                      data-modal-standings="true"
                      class="wg_loader">
                    </div>`
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Widget */}
          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-orbitron">Ligas Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  dangerouslySetInnerHTML={{
                    __html: `<div id="wg-api-football-leagues"
                      data-host="v3.football.api-sports.io"
                      data-key="${apiKey}"
                      data-theme="dark"
                      data-lang="pt"
                      data-show-toolbar="true"
                      data-show-errors="false"
                      data-show-logos="true"
                      data-modal-league="true"
                      data-modal-team="true"
                      data-modal-player="true"
                      class="wg_loader">
                    </div>`
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
