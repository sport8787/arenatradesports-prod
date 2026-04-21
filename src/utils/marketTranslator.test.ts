import { describe, it, expect } from 'vitest';
import { translateMarket } from './marketTranslator';

describe('translateMarket', () => {
  describe('fallbacks', () => {
    it('retorna travessão para vazio/null/undefined', () => {
      expect(translateMarket('')).toBe('—');
      expect(translateMarket(null)).toBe('—');
      expect(translateMarket(undefined)).toBe('—');
    });

    it('retorna texto original quando nenhum padrão casa', () => {
      expect(translateMarket('Mercado Exótico XYZ')).toBe('Mercado Exótico XYZ');
    });
  });

  describe('Handicap Asiático', () => {
    it('traduz com lado em inglês', () => {
      expect(translateMarket('AH +0.5 Away')).toBe(
        'AH +0.5 Visitante (Handicap Asiático +0.5 Visitante)'
      );
    });

    it('traduz Home como Mandante', () => {
      expect(translateMarket('AH -1.0 Home')).toBe(
        'AH -1.0 Mandante (Handicap Asiático -1.0 Mandante)'
      );
    });

    it('traduz AH sem lado especificado', () => {
      expect(translateMarket('AH +0.5')).toBe('AH +0.5 (Handicap Asiático +0.5)');
    });

    it('traduz AH negativo sem lado', () => {
      expect(translateMarket('AH -1.5')).toBe('AH -1.5 (Handicap Asiático -1.5)');
    });
  });

  describe('Handicap Europeu', () => {
    it('traduz EH com lado', () => {
      expect(translateMarket('EH +1 Away')).toBe(
        'EH +1 Visitante (Handicap Europeu +1 Visitante)'
      );
    });

    it('traduz EH sem lado', () => {
      expect(translateMarket('EH -1')).toBe('EH -1 (Handicap Europeu -1)');
    });
  });

  describe('Over/Under gols', () => {
    it('traduz Over 2.5', () => {
      expect(translateMarket('Over 2.5')).toBe('Mais de 2.5 gols (Over 2.5)');
    });

    it('traduz Under 1.5', () => {
      expect(translateMarket('Under 1.5')).toBe('Menos de 1.5 gols (Under 1.5)');
    });

    it('traduz O/U combinado', () => {
      expect(translateMarket('O/U 2.5')).toBe('Mais/Menos de 2.5 gols (O/U 2.5)');
      expect(translateMarket('OU 3.5')).toBe('Mais/Menos de 3.5 gols (O/U 3.5)');
    });
  });

  describe('Escanteios', () => {
    it('traduz Corner Over 8.5', () => {
      expect(translateMarket('Corner Over 8.5')).toBe(
        'Mais de 8.5 escanteios (Corner Over 8.5)'
      );
    });

    it('traduz Corners Under 9.5', () => {
      expect(translateMarket('Corners Under 9.5')).toBe(
        'Menos de 9.5 escanteios (Corner Under 9.5)'
      );
    });

    it('traduz Over X corners', () => {
      expect(translateMarket('Over 10 corners')).toBe(
        'Mais de 10 escanteios (Over 10 Corners)'
      );
    });

    it('traduz com prefixo PT-BR', () => {
      expect(translateMarket('Under 8.5 escanteios')).toBe(
        'Menos de 8.5 escanteios (Under 8.5 Corners)'
      );
    });
  });

  describe('Cartões', () => {
    it('traduz Card Over 4.5', () => {
      expect(translateMarket('Card Over 4.5')).toBe(
        'Mais de 4.5 cartões (Card Over 4.5)'
      );
    });

    it('traduz Over X cards', () => {
      expect(translateMarket('Over 3.5 cards')).toBe(
        'Mais de 3.5 cartões (Over 3.5 Cards)'
      );
    });
  });

  describe('Dupla Chance', () => {
    it('1X em PT', () => {
      expect(translateMarket('Dupla Chance 1X')).toBe('Dupla Chance Casa ou Empate (1X)');
    });
    it('X2 em EN', () => {
      expect(translateMarket('Double Chance X2')).toBe('Dupla Chance Empate ou Visitante (X2)');
    });
    it('DC abreviado', () => {
      expect(translateMarket('DC 12')).toBe('Dupla Chance Casa ou Visitante (12)');
    });
  });

  describe('BTTS / GG / NG', () => {
    it('BTTS Yes', () => {
      expect(translateMarket('BTTS Yes')).toBe('Ambas Marcam Sim (BTTS Yes)');
    });
    it('BTTS No', () => {
      expect(translateMarket('BTTS No')).toBe('Ambas Marcam Não (BTTS No)');
    });
    it('GG', () => {
      expect(translateMarket('GG')).toBe('Ambas Marcam Sim (GG)');
    });
    it('NG', () => {
      expect(translateMarket('NG')).toBe('Ambas Marcam Não (NG)');
    });
  });

  describe('1X2', () => {
    it('Home', () => {
      expect(translateMarket('1X2 Home')).toBe('Vitória Mandante (1)');
    });
    it('Draw', () => {
      expect(translateMarket('1X2: Draw')).toBe('Empate (X)');
    });
  });

  describe('HT/FT', () => {
    it('HT Over', () => {
      expect(translateMarket('HT Over 0.5')).toBe(
        'Mais de 0.5 gols no 1º tempo (HT Over 0.5)'
      );
    });
    it('FT Under', () => {
      expect(translateMarket('FT Under 2.5')).toBe(
        'Menos de 2.5 gols no jogo (FT Under 2.5)'
      );
    });
  });

  describe('preserva prefixos', () => {
    it('mantém prefixo ao traduzir trecho casado', () => {
      expect(translateMarket('Escanteios: Over 9.5 corners')).toBe(
        'Escanteios: Mais de 9.5 escanteios (Over 9.5 Corners)'
      );
    });
  });
});
