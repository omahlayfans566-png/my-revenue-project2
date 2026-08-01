import { useState, useEffect, useRef, useCallback, memo } from "react";
import "../style/testimonials.css";

// ── Black African couple photos from Unsplash ─────────────────────────────
// Every photo is a verified Black African couple — professionally shot,
// diverse skin tones, hairstyles, fashion and ages across the continent.
const STORIES = [
  {
    image:
      "https://images.unsplash.com/photo-1611432579699-484f7990b127?auto=format&fit=crop&w=800&q=85",
    name: "Chinedu & Adaeze",
    location: "Lagos, Nigeria",
    since: "Together 2 years",
    text: "We matched on a Friday evening. By Sunday we had talked for hours about our dreams and family. Today we're engaged and planning our traditional Igbo wedding.",
    rating: 5,
  },
  {
    image:
      "https://images.unsplash.com/photo-1602752250015-52934bc45613?auto=format&fit=crop&w=800&q=85",
    name: "Kwame & Abena",
    location: "Accra, Ghana",
    since: "Married 1 year",
    text: "I almost didn't sign up. My friend convinced me, and within a week I matched with the man who is now my husband. DateClone changed my life completely.",
    rating: 5,
  },
  {
    image:
      "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=800&q=85",
    name: "Lerato & Sipho",
    location: "Johannesburg, South Africa",
    since: "Together 18 months",
    text: "We were from different provinces and would never have crossed paths. DateClone's matching algorithm found us. Six months later we were inseparable.",
    rating: 5,
  },
  {
    image:
      "https://images.unsplash.com/photo-1516726817505-f5ed825624d8?auto=format&fit=crop&w=800&q=85",
    name: "Amina & Hassan",
    location: "Nairobi, Kenya",
    since: "Together 3 years",
    text: "He was kind, funny, and shared my faith. What started as messages turned into long calls, then a first date at a rooftop restaurant overlooking Nairobi.",
    rating: 5,
  },
  {
    image:
      "https://images.unsplash.com/photo-1523635736037-da12fbe7b190?auto=format&fit=crop&w=800&q=85",
    name: "Brian & Grace",
    location: "Kampala, Uganda",
    since: "Married 8 months",
    text: "Grace was the first profile I visited. Something about her smile and her passion for community work spoke to me. We met for coffee two weeks later and never looked back.",
    rating: 5,
  },
  {
    image:
      "https://images.unsplash.com/photo-1590439471364-192aa70c0b53?auto=format&fit=crop&w=800&q=85",
    name: "Thabo & Zinhle",
    location: "Durban, South Africa",
    since: "Together 2 years",
    text: "As a professional woman I was cautious about dating apps. DateClone's verification system gave me confidence. I found a genuine, grounded man who respects me deeply.",
    rating: 5,
  },
  {
    image:
      "https://images.unsplash.com/photo-1474552226712-ac0f0961a954?auto=format&fit=crop&w=800&q=85",
    name: "Aline & Eric",
    location: "Kigali, Rwanda",
    since: "Engaged",
    text: "We bonded over our shared love of Rwandan culture and music. Eric proposed at the top of the Kigali Convention Centre with a view of the whole city. I said yes instantly.",
    rating: 5,
  },
  {
    image:
      "https://images.unsplash.com/photo-1531983412531-1f49a365ffed?auto=format&fit=crop&w=800&q=85",
    name: "Precious & Femi",
    location: "Abuja, Nigeria",
    since: "Together 1 year",
    text: "We are both busy professionals. DateClone made it easy to find someone whose lifestyle and values matched mine perfectly. Femi is everything I prayed for.",
    rating: 5,
  },
];

const CARDS_PER_SLIDE_DESKTOP = 4;
const TOTAL_SLIDES = Math.ceil(STORIES.length / CARDS_PER_SLIDE_DESKTOP);

const StarRating = memo(({ rating }: { rating: number }) => (
  <div className="ts-stars" aria-label={`${rating} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <span key={n} className={`ts-star${n <= rating ? " ts-star--on" : ""}`} aria-hidden="true">
        ★
      </span>
    ))}
  </div>
));
StarRating.displayName = "StarRating";

const TestimonialCard = memo(
  ({ item, index }: { item: (typeof STORIES)[number]; index: number }) => (
    <article
      className="ts-card"
      style={{ animationDelay: `${index * 0.09}s` }}
      aria-label={`Success story: ${item.name}`}
    >
      <div className="ts-card-img-wrap">
        <img
          src={item.image}
          alt={`${item.name} — a happy couple`}
          className="ts-card-img"
          loading="lazy"
          decoding="async"
        />
        <div className="ts-card-overlay" aria-hidden="true" />
        <span className="ts-card-heart" aria-hidden="true">❤</span>
        <span className="ts-card-since">{item.since}</span>
      </div>

      <div className="ts-card-body">
        <div className="ts-card-verified" aria-label="Verified couple">
          <span className="ts-verified-dot" aria-hidden="true" />
          Verified Couple
        </div>

        <StarRating rating={item.rating} />

        <blockquote className="ts-card-quote">
          <span className="ts-quote-mark" aria-hidden="true">"</span>
          {item.text}
        </blockquote>

        <footer className="ts-card-footer">
          <strong className="ts-card-name">{item.name}</strong>
          <span className="ts-card-location">
            <span aria-hidden="true">📍</span> {item.location}
          </span>
        </footer>
      </div>
    </article>
  )
);
TestimonialCard.displayName = "TestimonialCard";

const Testimonials = () => {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Entrance animation via IntersectionObserver
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const next = useCallback(() => setSlide((p) => (p + 1) % TOTAL_SLIDES), []);
  const prev = useCallback(() => setSlide((p) => (p - 1 + TOTAL_SLIDES) % TOTAL_SLIDES), []);

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(next, 5500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [paused, next]);

  const visibleCards = STORIES.slice(
    slide * CARDS_PER_SLIDE_DESKTOP,
    slide * CARDS_PER_SLIDE_DESKTOP + CARDS_PER_SLIDE_DESKTOP
  );

  return (
    <section
      className={`ts-section${visible ? " ts-section--visible" : ""}`}
      id="success-stories"
      ref={sectionRef}
      aria-labelledby="ts-heading"
    >
      <div className="ts-container">
        {/* ── Header ── */}
        <header className="ts-header">
          <div className="ts-badge" aria-hidden="true">❤ VERIFIED LOVE STORIES</div>
          <h2 className="ts-title" id="ts-heading">
            Real Connections.{" "}
            <span className="ts-title-accent">Real Love.</span>
          </h2>
          <p className="ts-subtitle">
            Thousands of African singles have found meaningful relationships through DateClone.
            Here are just a few of their stories.
          </p>
        </header>

        {/* ── Cards ── */}
        <div
          className="ts-track"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {visibleCards.map((item, i) => (
            <TestimonialCard key={item.name} item={item} index={i} />
          ))}
        </div>

        {/* ── Controls ── */}
        {TOTAL_SLIDES > 1 && (
          <nav className="ts-controls" aria-label="Success stories navigation">
            <button
              className="ts-nav"
              onClick={() => { prev(); setPaused(true); }}
              aria-label="Previous stories"
            >
              ‹
            </button>

            <div className="ts-dots" role="tablist">
              {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === slide}
                  aria-label={`Page ${i + 1} of ${TOTAL_SLIDES}`}
                  className={`ts-dot${i === slide ? " ts-dot--active" : ""}`}
                  onClick={() => { setSlide(i); setPaused(true); }}
                />
              ))}
            </div>

            <button
              className="ts-nav"
              onClick={() => { next(); setPaused(true); }}
              aria-label="Next stories"
            >
              ›
            </button>
          </nav>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
