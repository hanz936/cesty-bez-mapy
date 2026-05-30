import { useState } from 'react';
import { extractYoutubeId } from '../../utils/blogContent';

/** YouTube blok: lehký facade náhled, po kliknutí načte privacy-friendly iframe. */
export default function YoutubeEmbed({ videoId }) {
  const id = extractYoutubeId(videoId);
  const [open, setOpen] = useState(false);
  if (!id) return null;

  if (open) {
    return (
      <div className="blog-youtube">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="blog-youtube blog-youtube-facade"
      onClick={() => setOpen(true)}
      aria-label="Přehrát video"
    >
      <img
        src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <span className="blog-youtube-play" aria-hidden="true">▶</span>
    </button>
  );
}
