import {
  IconArchive,
  IconBrandSpotify,
  IconBrandYoutube,
  IconFileTypePdf,
  IconMusic,
  IconPhoto,
  IconVideo,
} from '@tabler/icons-react';
import { CATEGORY_META } from '../utils';

const TABS = [
  { id: 'video', Icon: IconVideo, accent: false, pdf: false },
  { id: 'audio', Icon: IconMusic, accent: false, pdf: false },
  { id: 'image', Icon: IconPhoto, accent: false, pdf: false },
  { id: 'compress', Icon: IconArchive, accent: false, pdf: false },
  { id: 'youtube', Icon: IconBrandYoutube, accent: false, youtube: true },
  { id: 'spotify', Icon: IconBrandSpotify, accent: false, spotify: true },
  { id: 'pdf', Icon: IconFileTypePdf, accent: false, pdf: true },
];

export default function CategoryBar({ active, onSelect }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map(({ id, Icon, youtube, spotify, pdf }) => {
        const meta = CATEGORY_META[id];
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`flex min-w-[110px] flex-1 flex-col items-start rounded-xl border px-4 py-3 text-left transition-ui ${
              selected
                ? 'border-discord-accent bg-discord-accent/15 shadow-tab'
                : 'border-discord-border bg-discord-panel hover:border-discord-accent/40'
            }`}
          >
            <Icon
              size={26}
              stroke={1.5}
              className={
                youtube && !selected
                  ? 'text-[#FF0000]'
                  : spotify && !selected
                    ? 'text-[#1DB954]'
                    : pdf && !selected
                    ? 'text-discord-red'
                    : selected
                      ? 'text-discord-accent'
                      : 'text-discord-secondary'
              }
            />
            <span
              className={`mt-2 font-semibold ${selected ? 'text-discord-accent' : 'text-discord-text'}`}
            >
              {meta?.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
