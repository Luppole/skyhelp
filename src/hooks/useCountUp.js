import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 (or previous value) to the target value.
 * @param {number} target - final value
 * @param {number} duration - ms
 * @returns {number} current animated value
 */
export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === prevTarget.current) return;
    const start = prevTarget.current;
    const end = target;
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValue(end);
        prevTarget.current = end;
      }
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}
