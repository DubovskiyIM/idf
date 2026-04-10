/**
 * §1.3-1.4 дизайна: построение контрол-обёртки на основе confirmation + irreversibility.
 * Возвращает одно из:
 *  - null (confirmation: "auto")
 *  - intentButton-дескриптор ({ type: "intentButton", ... })
 *  - composerEntry-дескриптор (для confirmation: "enter")
 *  - composite { trigger, overlay } (для confirmation: "form" или irreversibility)
 */

function makeOverlayKey(intentId) {
  return `overlay_${intentId}`;
}

export function wrapByConfirmation(intent, intentId, parameters) {
  const confirmation = intent.particles?.confirmation;
  const irreversibility = intent.irreversibility;
  const antagonist = intent.antagonist;

  // confirmation: "auto" — нет UI
  if (confirmation === "auto") return null;

  // Базовый intentButton
  const baseButton = {
    type: "intentButton",
    intentId,
    label: intent.name,
  };
  if (antagonist) baseButton.antagonist = antagonist;

  // irreversibility: high / medium — всегда требует confirmDialog overlay
  if (irreversibility === "high" || irreversibility === "medium") {
    const key = makeOverlayKey(intentId);
    return {
      trigger: { ...baseButton, opens: "overlay", overlayKey: key },
      overlay: {
        type: "confirmDialog",
        key,
        triggerIntentId: intentId,
        irreversibility,
        message: buildConfirmMessage(intent),
        confirmBy: irreversibility === "high"
          ? { type: "typeText", expected: firstEntityField(intent) || "delete" }
          : { type: "button" },
      },
      antagonist,
    };
  }

  switch (confirmation) {
    case "click": {
      if (parameters.length === 0) {
        return baseButton;
      }
      // С параметрами — opens popover overlay
      const key = makeOverlayKey(intentId);
      return {
        ...baseButton,
        opens: "overlay",
        overlayKey: key,
      };
    }

    case "enter": {
      // Метка для Слоя 2: собрать в composer
      return {
        type: "composerEntry",
        intentId,
        primaryParameter: parameters[0]?.name || "text",
        label: intent.name,
      };
    }

    case "form": {
      const key = makeOverlayKey(intentId);
      return {
        trigger: { ...baseButton, opens: "overlay", overlayKey: key },
        overlay: {
          type: "formModal",
          key,
          intentId,
          witnessPanel: (intent.particles.witnesses || [])
            .filter(w => w.includes("."))
            .map(w => ({ type: "text", bind: w })),
          parameters,
        },
        antagonist,
      };
    }

    case "file": {
      return {
        ...baseButton,
        filePicker: true,
        parameters,
      };
    }

    default:
      return baseButton;
  }
}

function firstEntityField(intent) {
  const witnesses = intent.particles?.witnesses || [];
  const dotted = witnesses.find(w => w.includes("."));
  return dotted || null;
}

function buildConfirmMessage(intent) {
  const witnesses = intent.particles?.witnesses || [];
  const preview = witnesses.filter(w => w.includes(".")).map(w => `{${w}}`).join(", ");
  return `${intent.name}${preview ? ": " + preview : ""}?`;
}
