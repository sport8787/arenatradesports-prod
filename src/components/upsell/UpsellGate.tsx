// Monta o modal/banner de upsell automático. Renderizado em App.tsx.
import { useState } from "react";
import { useDayPassUpsell } from "@/hooks/useDayPassUpsell";
import { UpsellModal } from "./UpsellModal";
import { UpsellBanner } from "./UpsellBanner";

export default function UpsellGate() {
  const { trigger, shouldShow, dismiss, msLeft, isDayPassUser, hasActiveUpsell } = useDayPassUpsell();
  const [modalOpen, setModalOpen] = useState(false);

  if (!isDayPassUser || hasActiveUpsell) return null;

  return (
    <>
      {shouldShow && trigger && (
        <UpsellBanner
          trigger={trigger}
          msLeft={msLeft}
          onClick={() => setModalOpen(true)}
          onDismiss={dismiss}
        />
      )}
      <UpsellModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        trigger={trigger ?? "4h"}
      />
    </>
  );
}
