import "../styles/testimonials.css";

const Testimonials = () => {
  return (
    <section className="testimonials">

      <h2>Success Stories ❤️</h2>

      <div className="testimonial-grid">

        <div className="testimonial-card">
          <p>
            "We met on DateClone and got engaged after 8 months.
            It changed our lives."
          </p>

          <h4>Sarah & David</h4>
        </div>

        <div className="testimonial-card">
          <p>
            "The matching system helped me find someone who truly
            understands me."
          </p>

          <h4>Jessica & Michael</h4>
        </div>

        <div className="testimonial-card">
          <p>
            "I never thought online dating could be this genuine.
            Highly recommended."
          </p>

          <h4>Grace & John</h4>
        </div>

      </div>

    </section>
  );
};

export default Testimonials;