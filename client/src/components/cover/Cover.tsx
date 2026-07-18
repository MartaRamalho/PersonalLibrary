import { FC, useEffect, useState } from "react";

interface Props {
  url: string | null;
  title: string;
  className?: string;
}

// Book cover with a graceful typographic fallback — used both when there's no
// image URL and when the image fails to load (e.g. an Open Library ISBN cover
// that 404s with ?default=false).
export const Cover: FC<Props> = ({ url, title, className = "" }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={`Cover of ${title}`}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`object-cover bg-ink/5 ${className}`}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-brass/20 to-walnut/20 p-2 text-center ${className}`}
    >
      <span className="font-serif text-xs leading-tight text-ink/70 line-clamp-4">
        {title}
      </span>
    </div>
  );
};
