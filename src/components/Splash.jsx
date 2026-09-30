import { FreezerAisle } from '../illustrations/scenes';
import { Icon } from '../lib/icons';

// Full-screen loading state between sign-in and the app, continuing the
// freezer-aisle scene from the sign-in page.
export default function Splash({ label = 'Loading…' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <FreezerAisle className="splash-scene" />
      <div className="splash-card">
        <span className="brand-mark"><Icon.Forklift /></span>
        <div className="brand-name">HLPI Facilities</div>
        <div className="splash-label">{label}</div>
        <div className="splash-bar" aria-hidden="true"><div /></div>
      </div>
    </div>
  );
}
