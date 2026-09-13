'use client';

import { ChannelSwitcher, type Channel } from '../cinematic/channel-switcher';
import { useStage } from '../cinematic/stage-context';

/**
 * Joins the switcher to the stage.
 *
 * A one-line client bridge exists because `onTune` is a function and the
 * page is a Server Component — the alternative would be making the whole act
 * client-side for the sake of one callback.
 */
export function ChannelAct({ channels }: { channels: Channel[] }): React.JSX.Element {
  const { setThemeKey } = useStage();
  return <ChannelSwitcher channels={channels} onTune={setThemeKey} />;
}
