import { Footer } from '../../components/footer';
import { Header } from '../../components/header';
import { MiniPlayer } from '../../components/player/mini-player';
import { PlayerProvider } from '../../components/player/player-context';

/**
 * Header + main + footer, wrapped in `<PlayerProvider>` so playback state
 * survives every navigation within this route group — the provider and the
 * `<MiniPlayer>` it renders live above `{children}`, not inside it.
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <PlayerProvider>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <MiniPlayer />
    </PlayerProvider>
  );
}
