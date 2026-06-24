# DateClone - Full Stack Dating App Setup Guide

Complete guide to setting up and running DateClone (frontend + backend).

## 📋 Project Overview

DateClone is a premium dating application with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + MongoDB
- **Features**: User registration, matching algorithm, messaging, premium tiers, Stripe payments

## 🎯 Quick Start

### Prerequisites

Before starting, ensure you have:
- Node.js 16+ and npm/yarn
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account)
- Stripe account for payments ([stripe.com](https://stripe.com))
- Gmail account for email verification

### 1. Frontend Setup

```bash
# Navigate to frontend directory
cd dateclone

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

Frontend runs on: `http://localhost:5173`

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure .env with:
# - MongoDB connection
# - JWT secret
# - Gmail credentials
# - Stripe keys

# Start backend server
npm run dev
```

Backend runs on: `http://localhost:5000`

## ⚙️ Configuration Guide

### Frontend Configuration

**File: `dateclone/.env`**

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=DateClone
VITE_FRONTEND_URL=http://localhost:5173
VITE_STRIPE_PUBLIC_KEY=pk_test_your_key
VITE_ENABLE_EMAIL_VERIFICATION=true
VITE_ENABLE_PREMIUM=true
```

### Backend Configuration

**File: `backend/.env`**

#### MongoDB Setup

**Option 1: Local MongoDB**
```bash
# Install MongoDB
# Windows: Download from https://www.mongodb.com/try/download/community
# macOS: brew install mongodb-community
# Linux: Follow MongoDB installation guide

# Start MongoDB
mongod

# In .env:
MONGODB_URI=mongodb://localhost:27017/dateclone
```

**Option 2: MongoDB Atlas (Cloud)**
```
1. Create account at https://www.mongodb.com/cloud/atlas
2. Create cluster and database "dateclone"
3. Get connection string: mongodb+srv://username:password@cluster.mongodb.net/dateclone
4. In .env:
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dateclone
```

#### JWT Configuration

```bash
# Generate secure secret key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env:
JWT_SECRET=<generated_key>
```

#### Gmail Setup (Email Verification)

1. **Enable 2FA on Gmail**
   - Go to [myaccount.google.com](https://myaccount.google.com)
   - Security → 2-Step Verification

2. **Generate App Password**
   - Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Windows Computer"
   - Copy generated password

3. **Add to .env:**
```
GMAIL_USER=your_email@gmail.com
GMAIL_PASSWORD=app_password_from_step_2
```

#### Stripe Setup

1. **Get API Keys**
   - Go to [Stripe Dashboard](https://dashboard.stripe.com/)
   - API Keys section
   - Copy Test Secret Key (starts with `sk_test_`)

2. **Add to .env:**
```
STRIPE_PUBLIC_KEY=pk_test_your_public_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
```

3. **Complete .env:**
```
# MongoDB
MONGODB_URI=mongodb://localhost:27017/dateclone

# JWT
JWT_SECRET=your_generated_secret_key

# Email
GMAIL_USER=your_email@gmail.com
GMAIL_PASSWORD=app_password

# Stripe
STRIPE_PUBLIC_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx

# URLs
FRONTEND_URL=http://localhost:5173
PORT=5000
NODE_ENV=development
```

## 🚀 Running the Application

### Start Both Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd dateclone
npm run dev
# Runs on http://localhost:5173
```

### Verify Setup

1. **Backend Health Check**
   ```bash
   curl http://localhost:5000/api/health
   # Expected: { "status": "Backend is running!" }
   ```

2. **Frontend Loading**
   - Open `http://localhost:5173` in browser
   - Should see DateClone homepage

## 📱 Testing the Application

### 1. User Registration

1. Click "Sign Up" on homepage
2. Fill 7-step registration form:
   - Step 1: Account info (email, password)
   - Step 2: Personal info (age, gender, location)
   - Step 3: Profile details (photos, bio)
   - Step 4: Interests
   - Step 5: Match preferences
   - Step 6: Relationship preferences
   - Step 7: Email verification

### 2. Email Verification

1. Check email (or Gmail inbox) for verification link
2. Click link or use "Verify Email" button
3. Account activated after verification

### 3. Profile Browsing

1. Login with registered account
2. See suggested matches based on:
   - Age and location preferences
   - Interest compatibility
   - Relationship goals
   - Religion and lifestyle alignment

### 4. Matching & Messaging

1. Like profiles or pass
2. When both users like each other → Match created
3. Send messages to matched users
4. View message history

### 5. Premium Features

1. Click "Upgrade to Premium"
2. Select Gold ($9.99) or Platinum ($19.99)
3. Test payment with Stripe test card: `4242 4242 4242 4242`
4. Unlock premium features after payment

## 🛠️ Development Commands

### Frontend

```bash
cd dateclone

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Backend

```bash
cd backend

# Development (with auto-reload)
npm run dev

# Production
npm start

# Run specific node file
node server.js
```

## 📁 Project Structure

```
my-revenue2-project/
├── dateclone/                 # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── component/        # React components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API service
│   │   ├── style/            # CSS files
│   │   ├── App.tsx           # Main app
│   │   └── Main.tsx          # Entry point
│   ├── .env.example
│   └── package.json
│
└── backend/                   # Backend (Express + MongoDB)
    ├── config/               # Database config
    ├── models/               # Mongoose schemas
    ├── routes/               # API routes
    ├── middleware/           # Auth middleware
    ├── services/             # Business logic
    ├── server.js             # Express app
    ├── .env.example
    └── package.json
```

## 🐛 Common Issues & Solutions

### Issue: MongoDB Connection Error

```
MongoServerSelectionError: connect ECONNREFUSED
```

**Solution:**
```bash
# Check MongoDB is running
mongod --version

# Start MongoDB service
# macOS: brew services start mongodb-community
# Windows: Run MongoDB from Services
# Linux: sudo systemctl start mongod
```

### Issue: Email Verification Not Sending

```
Error: Invalid login: Not Configured for Less Secure App Access
```

**Solution:**
1. Use Gmail App Password (not regular password)
2. Enable 2FA on Gmail account
3. Verify `GMAIL_USER` and `GMAIL_PASSWORD` in .env

### Issue: CORS Error

```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution:**
1. Check `FRONTEND_URL` in backend .env
2. Verify CORS is enabled in server.js
3. Restart backend server

### Issue: Stripe Payment Failing

```
Error: Invalid API Key provided
```

**Solution:**
1. Use test API keys (start with `pk_test_` and `sk_test_`)
2. Verify keys in backend .env
3. Check Stripe account has correct API version

### Issue: Port Already in Use

```
Error: listen EADDRINUSE: address already in use
```

**Solution:**
```bash
# Kill process on port 5000 (backend)
# macOS/Linux: lsof -ti:5000 | xargs kill -9
# Windows: netstat -ano | findstr :5000

# Kill process on port 5173 (frontend)
# macOS/Linux: lsof -ti:5173 | xargs kill -9
# Windows: netstat -ano | findstr :5173
```

## 🔒 Security Checklist

- [ ] Change `JWT_SECRET` to unique random string
- [ ] Use MongoDB Atlas (don't expose local MongoDB)
- [ ] Keep `.env` files out of version control
- [ ] Use HTTPS in production
- [ ] Validate all inputs on backend
- [ ] Enable rate limiting
- [ ] Set strong password requirements
- [ ] Implement XSS protection
- [ ] Use CSRF tokens for forms
- [ ] Sanitize user inputs

## 📚 API Documentation

Full API documentation available in [backend/README.md](./backend/README.md)

Key endpoints:
- **Auth**: `/api/auth/register`, `/api/auth/login`, `/api/auth/verify-email`
- **Profile**: `/api/profile/:userId`, `/api/profile`
- **Matches**: `/api/matches/suggestions`, `/api/matches/like`
- **Messages**: `/api/messages/send`, `/api/messages/conversation/:userId`
- **Payment**: `/api/payment/create-intent`, `/api/payment/confirm`

## 🚀 Deployment

### Frontend Deployment (Vercel)

```bash
cd dateclone
npm run build
# Deploy the `dist` folder to Vercel
```

### Backend Deployment (Heroku/Railway)

```bash
cd backend
# Set environment variables
# Deploy with your chosen platform
```

## 📞 Support & Troubleshooting

1. **Check console logs** for error messages
2. **Verify all .env variables** are set correctly
3. **Restart both servers** after .env changes
4. **Check database connection** with MongoDB Atlas UI
5. **Test API endpoints** with Postman/Insomnia

## 🎓 Learning Resources

- [Express.js Docs](https://expressjs.com/)
- [MongoDB Docs](https://docs.mongodb.com/)
- [React Docs](https://react.dev/)
- [Stripe API Docs](https://stripe.com/docs)
- [Mongoose Docs](https://mongoosejs.com/)

## 📄 License

All rights reserved. Proprietary project.

---

**Happy coding! 💕**
