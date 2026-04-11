import { Hero } from '@/components/home/Hero';
import { Features } from '@/components/home/Features';
import { Stats } from '@/components/home/Stats';
import { CTA } from '@/components/home/CTA';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <CTA />
    </>
  );
}
