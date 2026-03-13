import { useCountUp } from '../../hooks/useCountUp';

/**
 * Displays a number with a count-up animation.
 * @param {number} value - target value
 * @param {function} formatter - optional formatting function
 * @param {number} duration - animation ms
 */
export default function AnimatedNumber({ value = 0, formatter = v => v.toLocaleString(), duration = 800 }) {
  const animated = useCountUp(value, duration);
  return <span>{formatter(animated)}</span>;
}
