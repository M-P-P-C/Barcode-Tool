// The beep and vibration when the camera reads a barcode.

let audio: AudioContext | null = null;

/**
 * Browsers only allow sound after the user has tapped something. Call this from a tap
 * (the link to the camera page, or any button on it) so the first beep can play.
 */
export function allowSound(): void {
  try {
    if (!audio || audio.state === 'closed') audio = new AudioContext();
    // Safari can also be "interrupted", e.g. after returning from another app.
    if (audio.state !== 'running') void audio.resume();
  } catch {
    audio = null; // no sound in this browser; vibration still works
  }
}

/** A short, high beep, like a shop scanner. Silent if sound isn't allowed yet. */
export function beep(): void {
  if (!audio || audio.state !== 'running') return;
  const start = audio.currentTime;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.type = 'square';
  tone.frequency.value = 2400;
  // Fade out quickly so it doesn't click at the end.
  volume.gain.setValueAtTime(0.08, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
  tone.connect(volume).connect(audio.destination);
  tone.start(start);
  tone.stop(start + 0.12);
}

/** A short buzz on phones that support it (Android; iPhones don't allow it). */
export function vibrate(): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(80);
}
