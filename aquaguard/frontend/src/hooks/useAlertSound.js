import { useRef, useCallback } from 'react';

/**
 * Custom hook that plays a pulsing alarm sound for a specified duration
 * using the Web Audio API. No external audio files needed.
 *
 * @param {number} durationMs – how long the alarm plays (default 5000ms)
 * @returns {Function} playAlarm – call to trigger the alarm
 */
export default function useAlertSound(durationMs = 5000) {
  const playingRef = useRef(false);
  const stopRef    = useRef(null);

  const playAlarm = useCallback(() => {
    // Prevent overlapping alarms
    if (playingRef.current) return;
    playingRef.current = true;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const endTime = ctx.currentTime + durationMs / 1000;
      const nodes = [];

      // Create a pulsing two-tone alarm: alternates between two frequencies
      const createTone = (freq, startOffset, length) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Quick ramp up/down for each pulse
        gain.gain.setValueAtTime(0, ctx.currentTime + startOffset);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + startOffset + 0.04);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + startOffset + length - 0.04);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startOffset + length);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startOffset);
        osc.stop(ctx.currentTime + startOffset + length);
        nodes.push(osc, gain);
      };

      // Schedule alternating pulses for the full duration
      const pulseDuration = 0.35;  // each beep length
      const pauseDuration = 0.15;  // gap between beeps
      const cycleLength   = pulseDuration + pauseDuration;
      const totalCycles   = Math.floor(durationMs / 1000 / cycleLength);

      for (let i = 0; i < totalCycles; i++) {
        const offset = i * cycleLength;
        // Alternate between high and low tone for urgency
        const freq = i % 2 === 0 ? 880 : 660;
        createTone(freq, offset, pulseDuration);
      }

      // Auto-cleanup
      const cleanupTimer = setTimeout(() => {
        ctx.close().catch(() => {});
        playingRef.current = false;
      }, durationMs + 200);

      // Allow manual stop
      stopRef.current = () => {
        nodes.forEach(n => { try { n.disconnect(); } catch {} });
        ctx.close().catch(() => {});
        clearTimeout(cleanupTimer);
        playingRef.current = false;
      };

    } catch (err) {
      console.warn('Alert sound unavailable:', err);
      playingRef.current = false;
    }
  }, [durationMs]);

  const stopAlarm = useCallback(() => {
    stopRef.current?.();
  }, []);

  return { playAlarm, stopAlarm };
}
