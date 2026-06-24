

import "../style/auth.css";
const Login = () => {
  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-header">
          <h1>Welcome Back </h1>
          <p>Login and continue your journey to finding love.</p>
        </div>

        <form className="auth-form">
          <input type="email" placeholder="Email Address" />
          <input type="password" placeholder="Password" />

          <button type="submit" className="auth-btn">
            Login
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?
          <span> Sign Up</span>
        </div>

      </div>
    </div>
  );
};

export default Login;
