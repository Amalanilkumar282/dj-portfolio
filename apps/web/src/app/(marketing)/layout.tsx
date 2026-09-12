import { CommandPalette } from '../../components/command-palette';
import { Footer } from '../../components/footer';
import { Header } from '../../components/header';
import { LenisProvider } from '../../components/lenis-provider';
import { MiniPlayer } from '../../components/player/mini-player';
import { PlayerProvider } from '../../components/player/player-context';
import { getPersonas } from '../../server/queries/personas';

/**
 * Header + main + footer, wrapped in `<PlayerProvider>` so playback state
 * survives every navigation within this route group — the provider and the
 * `<MiniPlayer>` it renders live above `{children}`, not inside it.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const personas = await getPersonas();

  return (
    <PlayerProvider>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <MiniPlayer />
      <LenisProvider />
      <CommandPalette personas={personas.map((p) => ({ slug: p.slug, stageName: p.stageName }))} />
    </PlayerProvider>
  );
}
