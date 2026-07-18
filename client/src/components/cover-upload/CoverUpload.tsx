import { FC, useRef, useState } from "react";
import type { Book } from "../../api/types";
import { useRemoveCover, useUploadCover } from "../../api/hooks";
import { fileToDataUrl, validateImage } from "./CoverUpload.utils";

interface Props {
  book: Book;
}

// Upload / remove a custom cover for a book. Reuses the hidden-file-input idiom
// from ImportGoodreads; reads the image to a base64 data URL and sends it as JSON.
export const CoverUpload: FC<Props> = ({ book }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadCover = useUploadCover();
  const removeCover = useRemoveCover();
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);

    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    try {
      const image = await fileToDataUrl(file);
      await uploadCover.mutateAsync({ id: book.id, image });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const busy = uploadCover.isPending || removeCover.isPending;

  return (
    <div className="mt-3 flex flex-col items-center gap-2 sm:items-start">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="btn-outline text-sm disabled:opacity-50"
      >
        {uploadCover.isPending
          ? "Uploading…"
          : book.custom_cover
            ? "⬆ Replace cover"
            : "⬆ Upload cover"}
      </button>

      {book.custom_cover && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            removeCover.mutate(book.id);
          }}
          disabled={busy}
          className="text-sm text-ink/50 hover:text-red-600 disabled:opacity-50"
        >
          ✖ Remove custom cover
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
};
