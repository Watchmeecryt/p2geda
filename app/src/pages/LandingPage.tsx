import { LandingClose } from '@/components/landing/LandingClose';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingPrivacy } from '@/components/landing/LandingPrivacy';
import { LandingProof } from '@/components/landing/LandingProof';
import { LandingStory } from '@/components/landing/LandingStory';
import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * Five bands only:
 * 1. Cream hero · 2. Cream how-it-works · 3. Orange privacy eye
 * 4. Cream proof + FAQ · 5. Black close
 */
export function LandingPage() {
  useScrollReveal();

  return (
    <div className="landing-page-shell min-h-dvh">
      <main className="landing-main">
        <section className="landing-zone landing-zone--intro">
          <div className="landing-top">
            <LandingNav />
          </div>
          <div className="landing-zone__inner">
            <LandingHero />
          </div>
        </section>

        <section className="landing-zone landing-zone--story">
          <div className="landing-zone__inner">
            <LandingStory />
          </div>
        </section>

        <section className="landing-zone landing-zone--privacy">
          <div className="landing-zone__inner">
            <LandingPrivacy />
          </div>
        </section>

        <section className="landing-zone landing-zone--workflows">
          <div className="landing-zone__inner">
            <LandingProof />
          </div>
        </section>

        <section className="landing-zone landing-zone--close">
          <LandingClose />
        </section>
      </main>
    </div>
  );
}
