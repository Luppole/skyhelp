import { Compass, Sparkles, Target, TrendingUp } from 'lucide-react';
import PageHeader from './ui/PageHeader';

const STEPS = [
  {
    title: 'Pick a playstyle',
    desc: 'Choose flips, farming, dungeons, or slayers. The tools you use most will change.',
    Icon: Compass,
  },
  {
    title: 'Set alerts',
    desc: 'Use Price Alerts to track your target entry or exit points.',
    Icon: Target,
  },
  {
    title: 'Use the Bazaar',
    desc: 'Start with low risk flips and learn margins before scaling up.',
    Icon: TrendingUp,
  },
  {
    title: 'Track progress',
    desc: 'Log your portfolio and compare current value vs cost basis.',
    Icon: Sparkles,
  },
];

export default function GettingStarted() {
  return (
    <div className="page">
      <PageHeader
        icon={Compass}
        title="Getting Started"
        description="A quick guide to help new players make smart, low-risk moves."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {STEPS.map(step => (
          <div key={step.title} className="card card--glass">
            <div className="card__title">
              <step.Icon size={14} />
              {step.title}
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>{step.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
