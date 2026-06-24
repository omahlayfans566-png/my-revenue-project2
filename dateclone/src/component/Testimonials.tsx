import "../style/testimonials.css";

const testimonials = [
    {
        image: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200",
        name: "Ama & Kwame",
        location: "Accra, Ghana",
        text: "DateClone brought us together when we least expected it. Today we're building a future filled with love and understanding.",
        rating: 5
    },
    {
        image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200",
        name: "Lerato & Sipho",
        location: "Pretoria, South Africa",
        text: "We matched on DateClone and instantly connected. Six months later we got engaged.",
        rating: 5
    },
    {
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200",
        name: "Zinhle & Thabo",
        location: "Johannesburg, South Africa",
        text: "I never believed online dating could be genuine until I found my soulmate here.",
        rating: 5
    },
    {
        image: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1200",
        name: "Precious & Anita",
        location: "Lagos, Nigeria",
        text: "What started as a simple conversation turned into something beautiful. DateClone helped us find a connection that feels genuine, effortless, and lasting.",
        rating: 5
    }
];

const StarRating = ({ rating }) => {
    return (
        <div className="stars">
            {[...Array(rating)].map((_, i) => (
                <span key={i}>★</span>
            ))}
        </div>
    );
};

const Testimonials = () => {

    return (
        <section className="testimonials">

            <div className="stats">
                <div>
                    <h3>2M+</h3>
                    <p>Matches Made</p>
                </div>

                <div>
                    <h3>150K+</h3>
                    <p>Success Stories</p>
                </div>

                <div>
                    <h3>25+</h3>
                    <p>African Countries</p>
                </div>
            </div>

            <div className="testimonial-heading">
                <span className="badge">
                    ❤️ VERIFIED LOVE STORIES
                </span>

                <h2>
                    Real Connections.
                    <span> Real Love.</span>
                </h2>

                <p>
                    Thousands of African singles have found
                    meaningful relationships through DateClone.
                </p>
            </div>

            <div className="testimonial-grid">
                {testimonials.map((item, index) => (
                    <div className="testimonial-card" key={index}>
                        <div className="image-box">
                            <img src={item.image} alt={item.name} />

                            <div className="heart-badge">
                                ❤️
                            </div>
                        </div>

                        <div className="testimonial-content">
                            <div className="verified">
                                ✓ Verified Couple
                            </div>

                            <StarRating rating={item.rating} />

                            <p>{item.text}</p>

                            <h4>{item.name}</h4>

                            <span className="testimonial-location">{item.location}</span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Testimonials;