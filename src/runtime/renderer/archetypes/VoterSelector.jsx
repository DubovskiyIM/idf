import { useEffect, useMemo } from "react";
import { getAdaptedComponent } from "../adapters/registry.js";

/**
 * VoterSelector — view-state селектор «Голосовать как: X».
 *
 * Рендерится в ArchetypeDetail, если projection объявила `voterSelector`.
 * Позволяет выбрать участника опроса, от имени которого будут отправляться
 * vote-интенты (vote_yes/vote_no/vote_maybe) из voteGroup.
 *
 * Необходим, потому что §23 манифеста фиксирует открытый вопрос:
 * vote-интенты ожидают `participantId`, но viewer в planning-домене не
 * привязан к participant-у автоматически. Явный селектор закрывает этот
 * разрыв для демо.
 *
 * Авто-выбор: если viewer.email совпадает с email участника — выбирается
 * автоматически. Fallback: первый участник.
 *
 * Результат пишется в `ctx.viewState[spec.stateKey]` и читается VoteGroup'ом
 * в SubCollectionSection.
 */
export default function VoterSelector({ spec, target, ctx }) {
  const { source, foreignKey, labelField, stateKey } = spec;

  const participants = useMemo(() => {
    const all = ctx.world?.[source] || [];
    if (!foreignKey || !target?.id) return all;
    return all.filter(p => p[foreignKey] === target.id);
  }, [ctx.world, source, foreignKey, target]);

  const currentValue = ctx.viewState?.[stateKey] || "";

  // Авто-выбор: по email, потом первый.
  useEffect(() => {
    if (!ctx.setViewState || currentValue) return;
    if (participants.length === 0) return;
    const byEmail = ctx.viewer?.email
      ? participants.find(p => p.email && p.email === ctx.viewer.email)
      : null;
    const picked = byEmail || participants[0];
    if (picked) ctx.setViewState(stateKey, picked.id);
  }, [participants, currentValue, stateKey, ctx.setViewState, ctx.viewer]);

  // Если текущий выбор указывает на исчезнувшего participant'а — сбросить.
  useEffect(() => {
    if (!currentValue) return;
    if (!participants.some(p => p.id === currentValue)) {
      ctx.setViewState?.(stateKey, "");
    }
  }, [currentValue, participants, stateKey, ctx.setViewState]);

  if (participants.length === 0) return null;

  const data = participants.map(p => ({
    value: p.id,
    label: p[labelField] || p.name || p.id,
  }));

  const AdaptedSelect = getAdaptedComponent("parameter", "select");
  const AdaptedPaper = getAdaptedComponent("primitive", "paper");
  const Wrapper = AdaptedPaper || FallbackPaper;

  const onChange = (val) => {
    ctx.setViewState?.(stateKey, val || "");
  };

  return (
    <Wrapper padding="md">
      {AdaptedSelect ? (
        <AdaptedSelect
          spec={{
            name: "voter",
            label: "Голосовать как",
            options: data,
            placeholder: "Выберите участника…",
          }}
          value={currentValue || null}
          onChange={onChange}
        />
      ) : (
        <>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--mantine-color-dimmed)",
            marginBottom: 8,
          }}>
            Голосовать как
          </div>
          <select
            value={currentValue}
            onChange={e => onChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid var(--mantine-color-default-border)",
              background: "var(--mantine-color-default)",
              color: "var(--mantine-color-text)",
              fontSize: 14,
            }}
          >
            <option value="">Выберите участника…</option>
            {data.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </>
      )}
    </Wrapper>
  );
}

function FallbackPaper({ children }) {
  return (
    <div style={{
      background: "var(--mantine-color-default)",
      borderRadius: 12,
      padding: 16,
      border: "1px solid var(--mantine-color-default-border)",
    }}>
      {children}
    </div>
  );
}
