import { useState, useRef, useEffect } from "react";
import { registerCaptureWidget } from "./registry.js";

/**
 * VoiceRecorder — MediaRecorder API в оверлее.
 *
 * UX: запись → preview → отправка. По отправке blob конвертируется в data URL
 * через FileReader (как ImageControl) и передаётся в intent.exec как поле
 * `audioUrl`. Для больших файлов в M4+ это должен быть upload → url, но для
 * прототипа inline data URL работает.
 *
 * intent должен иметь witness `recording_duration` или `duration` — по этому
 * признаку кристаллизатор матчит его на voiceRecorder (см. CAPTURE_RULES).
 */
export default function VoiceRecorder({ spec, ctx, onClose }) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);
  const mediaRecorderRef = useRef(null);
  const startTimeRef = useRef(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 200);
    } catch (e) {
      setError("Нет доступа к микрофону: " + e.message);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    clearInterval(intervalRef.current);
  };

  const reset = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
  };

  const send = () => {
    if (!audioBlob) return;
    const reader = new FileReader();
    reader.onload = () => {
      ctx.exec(spec.intentId, {
        audioUrl: reader.result,
        duration,
      });
      onClose();
    };
    reader.readAsDataURL(audioBlob);
  };

  const cancel = () => {
    if (recording) stopRecording();
    reset();
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={cancel}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
          Голосовое сообщение
        </h3>
        <div style={{ fontSize: 48, marginBottom: 8, lineHeight: 1 }}>
          {recording ? "🔴" : audioBlob ? "🎵" : "🎙"}
        </div>
        <div style={{ fontSize: 24, marginBottom: 16, fontFamily: "monospace", color: "#374151" }}>
          {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, "0")}
        </div>
        {audioUrl && !recording && (
          <audio src={audioUrl} controls style={{ marginBottom: 16, width: "100%" }} />
        )}
        {error && (
          <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {!recording && !audioBlob && (
            <button onClick={startRecording} style={btnStyle("#6366f1")}>● Запись</button>
          )}
          {recording && (
            <button onClick={stopRecording} style={btnStyle("#dc2626")}>■ Стоп</button>
          )}
          {audioBlob && !recording && (
            <>
              <button onClick={reset} style={btnStyle("#6b7280")}>↺ Заново</button>
              <button onClick={send} style={btnStyle("#10b981")}>Отправить</button>
            </>
          )}
          <button onClick={cancel} style={btnStyle("#6b7280", true)}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modalStyle = {
  background: "#fff", borderRadius: 12, padding: 24,
  minWidth: 360, maxWidth: 480, textAlign: "center",
  fontFamily: "system-ui, sans-serif",
};

const btnStyle = (bg, outline = false) => ({
  padding: "8px 16px", borderRadius: 6,
  border: outline ? `1px solid ${bg}` : "none",
  background: outline ? "#fff" : bg,
  color: outline ? bg : "#fff",
  cursor: "pointer", fontWeight: 600, fontSize: 14,
});

registerCaptureWidget({
  id: "voiceRecorder",
  match: (intent) => {
    const w = intent.particles?.witnesses || [];
    return w.includes("recording_duration") || w.includes("duration");
  },
  component: VoiceRecorder,
});
