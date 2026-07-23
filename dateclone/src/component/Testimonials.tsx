import { useState, useEffect, useRef, useCallback } from "react";
import "../style/testimonials.css";

const testimonials = [
  {
    image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&q=80",
    name: "Ama & Kwame",
    location: "Accra, Ghana",
    text: "DateClone brought us together when we least expected it. Today we're building a future filled with love and understanding.",
    rating: 5,
  },
  {
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&q=80",
    name: "Lerato & Sipho",
    location: "Pretoria, South Africa",
    text: "We matched on DateClone and instantly connected. Six months later we got engaged.",
    rating: 5,
  },
  {
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80",
    name: "Zinhle & Thabo",
    location: "Johannesburg, South Africa",
    text: "I never believed online dating could be genuine until I found my soulmate here.",
    rating: 5,
  },
  {
    image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=600&q=80",
    name: "Precious & Femi",
    location: "Lagos, Nigeria",
    text: "What started as a simple conversation turned into something beautiful. DateClone helped us find a connection that feels genuine, effortless, and lasting.",
    rating: 5,
  },
  {
    image: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80",
    name: "Nadia & Tunde",
    location: "Nairobi, Kenya",
    text: "We were miles apart but DateClone brought us together. Now we're planning our wedding!",
    rating: 5,
  },
  {
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80",
    name: "Fatima & Ahmed",
    location: "Cairo, Egypt",
    text: "Finding someone who shares your values and dreams is rare. DateClone made it possible.",
    rating: 5,
  },
];

const StarRating = ({ rating }: { rating: number }) => (
  <div className="test-star-rating">
    {[...Array(5)].map((_, i) => (
      <span key={i} className={`test-star ${i < rating ? "filled" : ""}`}>★</span>
    ))}
  </div>
);

const TOTAL_SLIDES = Math.ceil(testimonials.length / 4);

const Testimonials = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(Math.max(0, Math.min(index, TOTAL_SLIDES - 1)));
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % TOTAL_SLIDES);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) return;
    autoPlayRef.current = setInterval(nextSlide, 5000);
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isAutoPlaying, nextSlide]);

  // Intersection observer for entrance animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("testimonials-visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    const current = sectionRef.current;
    if (current) observer.observe(current);
    return () => {
      if (current) observer.unobserve(current);
    };
  }, []);

  const getVisibleTestimonials = () => {
    const start = currentSlide * 4;
    return testimonials.slice(start, start + 4);
  };

  return (
    <section className="testimonials-section" ref={sectionRef}>
      <div className="testimonials-container">
        {/* Header */}
        <div className="testimonials-header">
          <div className="testimonials-badge">
            ❤️ VERIFIED LOVE STORIES
          </div>
          <h2 className="testimonials-title">
            Real Connections. <span className="testimonials-title-gradient">Real Love.</span>
          </h2>
          <p className="testimonials-subtitle">
            Thousands of African singles have found meaningful relationships through DateClone.
          </p>
        </div>

        {/* Carousel */}
        <div className="testimonials-carousel">
          <div className="testimonials-track">
            {getVisibleTestimonials().map((item, index) => (
              <div className="testimonial-card" key={`${item.name}-${index}`}>
                <div className="testimonial-card-image-wrap">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="testimonial-card-image"
                    loading="lazy"
                  />
                  <div className="testimonial-card-heart">❤️</div>
                </div>
                <div className="testimonial-card-content">
                  <div className="testimonial-card-quote">"</div>
                  <div className="testimonial-card-verified">✓ Verified Couple</div>
                  <StarRating rating={item.rating} />
                  <p className="testimonial-card-text">{item.text}</p>
                  <h4 className="testimonial-card-name">{item.name}</h4>
                  <span className="testimonial-card-location">{item.location}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Controls */}
          {TOTAL_SLIDES > 1 && (
            <div className="testimonials-controls">
              <button
                className="testimonials-nav-btn"
                onClick={() => { prevSlide(); setIsAutoPlaying(false); }}
                aria-label="Previous"
              >
                ‹
              </button>
              <div className="testimonials-dots">
                {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
                  <button
                    key={i}
                    className={`testimonials-dot ${i === currentSlide ? "active" : ""}`}
                    onClick={() => { goToSlide(i); setIsAutoPlaying(false); }}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
              <button
                className="testimonials-nav-btn"
                onClick={() => { nextSlide(); setIsAutoPlaying(false); }}
                aria-label="Next"
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;