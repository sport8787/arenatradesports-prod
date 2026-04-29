import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AdminStatsEditorModal from './AdminStatsEditorModal';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('AdminStatsEditorModal', () => {
  const baseProps = {
    isOpen: true,
    onClose: () => {},
    matchId: 'match-1',
    homeTeam: 'Casa',
    awayTeam: 'Fora',
  };

  it('não reinicializa o input do usuário quando currentStats muda enquanto o modal está aberto', () => {
    const { rerender } = render(
      <AdminStatsEditorModal {...baseProps} currentStats={{ xG_home: 0 }} />
    );

    // Encontra o primeiro input de xG (xG_home) e digita um valor
    const inputs = screen.getAllByPlaceholderText('—') as HTMLInputElement[];
    const xgHomeInput = inputs[0];
    fireEvent.change(xgHomeInput, { target: { value: '1.55' } });
    expect(xgHomeInput.value).toBe('1.55');

    // Simula realtime/polling alterando currentStats
    rerender(
      <AdminStatsEditorModal
        {...baseProps}
        currentStats={{ xG_home: 0, xG_away: 2, possession_home: 60 }}
      />
    );

    const inputsAfter = screen.getAllByPlaceholderText('—') as HTMLInputElement[];
    // O valor digitado pelo admin deve permanecer intacto
    expect(inputsAfter[0].value).toBe('1.55');
  });

  it('reinicializa os valores quando o modal é reaberto', () => {
    const { rerender } = render(
      <AdminStatsEditorModal {...baseProps} isOpen={false} currentStats={{ xG_home: 0 }} />
    );

    rerender(
      <AdminStatsEditorModal {...baseProps} isOpen={true} currentStats={{ xG_home: 2.3 }} />
    );

    const inputs = screen.getAllByPlaceholderText('—') as HTMLInputElement[];
    expect(inputs[0].value).toBe('2.3');
  });
});
