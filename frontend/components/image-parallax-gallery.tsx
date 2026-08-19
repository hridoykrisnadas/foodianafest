'use client';

import { useRef } from 'react';
import { useLanguage } from '@/lib/language-context';

const galleryImages = [
  {
    src: '/gallery/Foodiana Flashback 1.webp',
    alt: 'Foodiana Festival food',
  },
  {
    src: '/gallery/Foodiana Flashback 2.webp',
    alt: 'Foodiana Festival',
  },
  {
    src: '/gallery/Gana Hobe - Foodiana Flashback.webp',
    alt: 'Foodiana Festival food and culture',
  },
  {
    src: '/gallery/Khana Hobe - Foodiana Flashback.webp',
    alt: 'Foodiana Festival event',
  },
  {
    src: '/gallery/Khela Hobe - Foodiana Flashback.webp',
    alt: 'Foodiana Festival',
  },
  {
    src: '/gallery/Mela Hobe - Foodiana Flashback.webp',
    alt: 'Foodiana Festival food',
  },
];

export default function ImageParallaxGallery() {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const { t, lang } = useLanguage();

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!trackRef.current) return;

    isDragging.current = true;
    startX.current = e.clientX;
    startScroll.current = trackRef.current.scrollLeft;

    trackRef.current.setPointerCapture(e.pointerId);
    trackRef.current.classList.add('cursor-grabbing');
  };

  const handlePointerMove = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (!isDragging.current || !trackRef.current) return;

    const distance = e.clientX - startX.current;

    trackRef.current.scrollLeft =
      startScroll.current - distance * 1.2;
  };

  const stopDragging = (
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    isDragging.current = false;

    if (trackRef.current) {
      trackRef.current.classList.remove('cursor-grabbing');

      try {
        trackRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
    }
  };

  return (
    <section className="relative overflow-hidden py-16 md:py-20">
      <div className="mb-8 text-center px-4">
        <p className="text-sm font-medium uppercase tracking-[0.25em] text-primary ${isBn ? 'font-bengali' : ''}`}">
          {t.gallery.title}
        </p>

        <h2 className="mt-2 text-3xl md:text-4xl font-bold ${isBn ? 'font-bengali' : ''}`}">
          {t.gallery.subtitle}
        </h2>
      </div>

      <div
        ref={trackRef}
        className="
          flex gap-5 overflow-x-auto
          px-6 md:px-10 lg:px-16
          cursor-grab select-none
          scrollbar-hide
          touch-pan-y
        "
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onPointerLeave={stopDragging}
      >
        {galleryImages.map((image, index) => (
          <div
            key={image.src}
            className="
              group
              relative
              flex-none
              w-[260px]
              sm:w-[320px]
              md:w-[380px]
              lg:w-[420px]
              aspect-[4/3]
              overflow-hidden
              rounded-2xl
              bg-muted
              shadow-lg
            "
          >
            <img
              src={image.src}
              alt={image.alt}
              draggable={false}
              className="
                h-full
                w-full
                object-cover
                transition-transform
                duration-700
                ease-out
                group-hover:scale-105
              "
              loading={index < 3 ? 'eager' : 'lazy'}
            />

            <div
              className="
                absolute inset-0
                bg-gradient-to-t
                from-black/40
                via-transparent
                to-transparent
                opacity-70
              "
            />
          </div>
        ))}
      </div>

      {/* <div className="mt-5 text-center text-xs text-foreground/40">
        Drag to explore
      </div> */}
    </section>
  );
}