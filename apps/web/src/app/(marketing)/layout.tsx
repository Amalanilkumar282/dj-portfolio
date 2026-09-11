import { Footer } from '../../components/footer';
import { Header } from '../../components/header';

/**
 * Header + main + footer. No mini player yet — it belongs above the route
 * slot so App Router never unmounts it across navigations, but it needs the
 * media catalogue's playback state (Phase 9) to be worth adding; a player
 * with nothing safely streamable yet is worse than none. See STATUS.md.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
