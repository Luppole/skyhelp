import { Coffee } from 'lucide-react';

const KOFI_URL = 'https://ko-fi.com/S6S71VTRIW';

export default function KoFiCorner() {
  return (
    <a
      className="kofi-corner"
      href={KOFI_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Support me on Ko-fi"
    >
      <Coffee size={16} />
      <span className="kofi-corner__text">Support me on Ko-fi</span>
    </a>
  );
}

