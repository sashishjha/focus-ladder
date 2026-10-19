/**
 * Soft sounds made with the Web Audio API so there are no audio files to
 * download. Each call is guarded: if audio is unavailable or blocked, the
 * app stays silent and keeps working.
 */

let context = null;

function getContext() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

/**
 * Play a short, quiet two-note chime.
 * @param {'done'|'end'} kind
 */
export function chime(kind = 'done') {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const notes = kind === 'done' ? [523.25, 659.25] : [440, 523.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    /* silence is fine */
  }
}
