import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface LightboxImage {
  url:      string;
  filename: string;
}

interface ImageLightboxProps {
  images:     LightboxImage[];
  startIndex: number;
  onClose:    () => void;
}

export function ImageLightbox({ images, startIndex, onClose }: ImageLightboxProps) {
  const [index, setIndex] = useState(startIndex);

  const prev = useCallback(() => setIndex((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowLeft")  prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Content — stop propagation so clicking the image doesn't close */}
      <div
        className="relative flex flex-col items-center max-w-[92vw] max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={current.url}
          alt={current.filename}
          className="max-w-[92vw] max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        <p className="mt-2 text-white/80 text-sm text-center max-w-[80vw] truncate">
          {current.filename}
        </p>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 transition-colors"
          aria-label="Close preview"
        >
          <X className="w-4 h-4 text-gray-800" />
        </button>

        {/* Prev / Next — only when multiple images */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 text-white/70 hover:text-white transition-colors"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button
              onClick={next}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2 text-white/70 hover:text-white transition-colors"
              aria-label="Next image"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
            <p className="mt-1 text-white/50 text-xs">
              {index + 1} / {images.length}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
