'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Soup, Wheat, Sandwich, Pizza, Store, Globe2, Salad, Flame,
  ChevronLeft, ChevronRight,
} from 'lucide-react';

type FoodItem = {
  icon: string;
  title: string;
  desc: string;
};

const iconMap: Record<string, typeof Soup> = {
  soup: Soup,
  wheat: Wheat,
  sandwich: Sandwich,
  pizza: Pizza,
  store: Store,
  globe: Globe2,
  salad: Salad,
  flame: Flame,
};

const cardColors = [
  'from-red-500/15 to-red-500/5 border-red-500/20',
  'from-amber-500/15 to-amber-500/5 border-amber-500/20',
  'from-orange-500/15 to-orange-500/5 border-orange-500/20',
  'from-emerald-500/15 to-emerald-500/5 border-emerald-500/20',
  'from-rose-500/15 to-rose-500/5 border-rose-500/20',
  'from-blue-500/15 to-blue-500/5 border-blue-500/20',
  'from-green-500/15 to-green-500/5 border-green-500/20',
  'from-yellow-500/15 to-yellow-500/5 border-yellow-500/20',
];

const iconColors = [
  'text-red-500',
  'text-amber-500',
  'text-orange-500',
  'text-emerald-500',
  'text-rose-500',
  'text-blue-500',
  'text-green-500',
  'text-yellow-600',
];

export default function FoodCarousel({ items, isBn }: { items: FoodItem[]; isBn: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons);
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.offsetWidth / (window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1);
    el.scrollBy({ left: dir === 'left' ? -cardWidth : cardWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      {/* Scroll buttons */}
      <button
        onClick={() => scroll('left')}
        disabled={!canScrollLeft}
        aria-label="Scroll left"
        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full glass-strong border border-border/40 flex items-center justify-center transition-all duration-200 ${
          canScrollLeft ? 'text-primary hover:border-primary/40 hover:shadow-red opacity-100' : 'opacity-30 cursor-not-allowed'
        }`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => scroll('right')}
        disabled={!canScrollRight}
        aria-label="Scroll right"
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full glass-strong border border-border/40 flex items-center justify-center transition-all duration-200 ${
          canScrollRight ? 'text-primary hover:border-primary/40 hover:shadow-red opacity-100' : 'opacity-30 cursor-not-allowed'
        }`}
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Scrollable cards */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 carousel-hide-scroll px-1"
      >
        {items.map((item, i) => {
          const Icon = iconMap[item.icon] || Soup;
          return (
            <div
              key={i}
              className={`snap-start shrink-0 w-[85%] sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)] rounded-2xl border bg-gradient-to-br ${cardColors[i % cardColors.length]} p-6 hover:scale-[1.02] transition-transform duration-300 group`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-xl bg-background/60 flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${iconColors[i % iconColors.length]}`} />
                </div>
                <h4 className={`font-display text-lg font-bold text-foreground leading-tight ${isBn ? 'font-bengali' : ''}`}>
                  {item.title}
                </h4>
              </div>
              <p className={`text-sm text-foreground/60 leading-relaxed ${isBn ? 'font-bengali' : ''}`}>
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
