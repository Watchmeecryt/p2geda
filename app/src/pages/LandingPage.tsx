import { LandingClose } from '@/components/landing/LandingClose';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingPreview } from '@/components/landing/LandingPreview';
import { LandingStory } from '@/components/landing/LandingStory';
import { LandingWorkflows } from '@/components/landing/LandingWorkflows';
import { useScrollReveal } from '@/hooks/useScrollReveal';

/**
 * Four stacked bands — light intro, warm cream story, white workflows, black
 * close — so the scroll reads as distinct chapters rather than one flat page.
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
            <LandingPreview />
            <LandingStory />
          </div>
        </section>

        <section className="landing-zone landing-zone--workflows">
          <div className="landing-zone__inner">
            <LandingWorkflows />
          </div>
        </section>

        <section className="landing-zone landing-zone--close">
          <LandingClose />
        </section>
      </main>
    </div>
  );
}
