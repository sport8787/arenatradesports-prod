import { useBCRewardToasts } from '@/hooks/useBCRewardToasts';

/** Componente invisível que apenas ativa os toasts globais de BC ganho. */
export default function BCRewardToastsMount() {
  useBCRewardToasts();
  return null;
}
