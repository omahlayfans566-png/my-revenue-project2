# DateClone Backend API

Premium dating app backend built with Express.js, MongoDB, and Stripe integration.

## 🚀 Features

- **User Registration & Authentication** - Complete multi-step registration with email verification
- **Profile Management** - Comprehensive user profiles with photos and preferences
- **Smart Matching Algorithm** - AI-powered compatibility scoring based on interests, age, location, and lifestyle
- **Real-time Messaging** - Instant messaging between matched users
- **Premium Tiers** - Gold and Platinum subscription plans with Stripe integration
- **Payment Processing** - Secure Stripe payment handling with webhook support
- **Email Verification** - Automated verification emails with Nodemailer
- **User Safety** - Blocking, reporting, and account management features

## 📋 Prerequisites

- Node.js 16+
- MongoDB 4.4+ (local or MongoDB Atlas)
- Stripe account
- Gmail account (for email verification)
- npm or yarn

## 🔧 Installation

### 1. Clone and Setup

```bash
cd backend
npm install
```

### 2. Environment Configuration

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Configure the following:

- **MONGODB_URI**: MongoDB connection string
  ```
  # Local: mongodb://localhost:27017/dateclone
  # Atlas: mongodb+srv://username:password@cluster.mongodb.net/dateclone
  ```

- **JWT_SECRET**: Secret key for JWT tokens (generate a strong random string)
  ```
  JWT_SECRET=$(openssl rand -hex 32)
  ```

- **Gmail Configuration**:
  - Enable 2FA on your Gmail account
  - Generate an [App Password](https://myaccount.google.com/apppasswords)
  - Set `GMAIL_USER` and `GMAIL_PASSWORD`

- **Stripe Keys**:
  - Get from [Stripe Dashboard](https://dashboard.stripe.com/)
  - Use test keys for development

- **FRONTEND_URL**: Your frontend URL (default: `http://localhost:5173`)

### 3. Start MongoDB

```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas connection string in .env
```

### 4. Install Global Dependencies (Optional)

```bash
npm install -g nodemon
```

## 📦 NPM Scripts

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start

# Run without nodemon
node server.js
```

## 📁 Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── models/
│   ├── User.js              # User schema with premium features
│   ├── Match.js             # Matching records
│   ├── Message.js           # User messages
│   └── Payment.js           # Payment transactions
├── routes/
│   ├── authRoutes.js        # Registration, login, verification
│   ├── profileRoutes.js     # Profile CRUD operations
│   ├── matchRoutes.js       # Like, match, suggestions
│   ├── paymentRoutes.js     # Payment processing
│   └── messageRoutes.js     # Messaging features
├── middleware/
│   └── auth.js              # JWT authentication
├── services/
│   ├── emailService.js      # Email sending with templates
│   ├── matchingService.js   # Compatibility algorithm
│   └── paymentService.js    # Stripe integration
├── server.js                # Express app setup
├── package.json
├── .env.example
└── README.md
```

## 🔌 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user with all form data |
| POST | `/verify-email` | Verify email with token |
| POST | `/resend-verification` | Resend verification email |
| POST | `/login` | Login with email and password |
| GET | `/me` | Get current user profile |

**Example Register Request:**
```javascript
POST /api/auth/register
{
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!",
  "dateOfBirth": "1990-05-15",
  "gender": "male",
  "lookingFor": "women",
  "country": "Nigeria",
  "state": "Lagos",
  "city": "Lagos",
  "profilePicture": "base64_image_or_url",
  "aboutMe": "Adventure seeker...",
  "occupation": "Software Engineer",
  "education": "bachelors",
  "languages": ["English", "French"],
  "interests": ["traveling", "music", "cooking"],
  "minAge": 22,
  "maxAge": 32,
  "preferredCountry": "Nigeria",
  "preferredDistance": "within_50km",
  "relationshipGoal": "long_term",
  "hasChildren": "no",
  "wantsChildren": "yes",
  "smoking": "never",
  "drinking": "socially",
  "religion": "Christianity",
  "religionImportance": "somewhat_important",
  "relationshipValue": "honesty",
  "latitude": 6.5244,
  "longitude": 3.3792
}
```

### Profile (`/api/profile`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:userId` | Get user profile |
| PUT | `/:userId` | Update user profile |
| POST | `/:userId/photo` | Upload profile photo |
| GET | `/` | Get all profiles with filters |

### Matching (`/api/matches`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/suggestions` | Get match suggestions |
| POST | `/like` | Like a user |
| POST | `/pass` | Pass on a user |
| GET | `/my-matches` | Get all matches |
| GET | `/likes-received` | Get incoming likes |
| POST | `/block` | Block a user |

**Like Request:**
```javascript
POST /api/matches/like
Headers: { "Authorization": "Bearer {token}" }
{
  "likedUserId": "user_id"
}
```

### Messages (`/api/messages`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/send` | Send message to matched user |
| GET | `/conversation/:otherUserId` | Get message history |
| GET | `/` | Get all conversations |
| DELETE | `/:messageId` | Delete message |

**Send Message Request:**
```javascript
POST /api/messages/send
Headers: { "Authorization": "Bearer {token}" }
{
  "toUserId": "user_id",
  "content": "Hello there! 😊",
  "image": "image_url_optional"
}
```

### Payment (`/api/payment`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pricing` | Get subscription plans |
| POST | `/create-intent` | Create Stripe payment intent |
| POST | `/confirm` | Confirm payment and activate premium |
| GET | `/status` | Check premium status |
| POST | `/cancel` | Cancel premium subscription |

**Create Payment Intent:**
```javascript
POST /api/payment/create-intent
Headers: { "Authorization": "Bearer {token}" }
{
  "tier": "gold",     // "gold" or "platinum"
  "duration": 1       // months
}
```

## 🔐 Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer {token}
```

Tokens expire in 30 days.

## 💾 Database Models

### User Schema
- Account info: email, username, password, phone
- Personal: name, age, gender, location, DOB
- Profile: aboutMe, occupation, education, languages, interests
- Preferences: age range, distance, country, relationship goals
- Premium: tier, expiry date, stripe ID
- Safety: blocked users, reported users

### Match Schema
- userId, matchedUserId
- Like status and timestamps
- Match status (viewed, liked, matched, rejected, blocked)
- Message count and last message time

### Message Schema
- fromUserId, toUserId
- Content and optional image
- Read status and timestamp
- Soft delete support

### Payment Schema
- userId, transaction ID
- Stripe payment intent ID
- Tier (gold/platinum), amount, duration
- Validity dates, auto-renewal status

## 🧮 Matching Algorithm

Compatibility score (0-100) based on:
- **Common interests** (30%): Shared interests boost score
- **Age proximity** (20%): Closer age match gets higher score
- **Religion** (20%): Same religion adds bonus
- **Relationship goals** (15%): Alignment increases compatibility
- **Children preferences** (15%): Match on current/future children plans

Score is also boosted for premium users and affected by location proximity.

## 💳 Payment Plans

**Gold ($9.99/month)**
- See who likes you
- Advanced filters
- Message anyone
- Unlimited likes

**Platinum ($19.99/month)**
- All Gold features
- Priority visibility
- Verified badge
- Instant messaging
- Hide profile
- Rematch feature
- 24/7 support

## 📧 Email Templates

Automated emails sent for:
- **Email Verification**: Confirmation link with 24-hour expiry
- **Welcome Email**: Sent after verification
- **Premium Activation**: Confirmation with tier details and expiry

Email templates use soft pink gradient brand colors (#ff1744, #ff4081).

## 🚨 Error Handling

All endpoints return consistent JSON responses:

**Success:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description"
}
```

## 🔒 Security Features

- **Password Hashing**: bcryptjs with 10 salt rounds
- **JWT Authentication**: 30-day expiry tokens
- **Input Validation**: express-validator for all endpoints
- **CORS**: Enabled for frontend origin
- **Email Verification**: Required before account activation
- **Rate Limiting**: (recommended to add)
- **XSS Protection**: (recommended to add)

## 📱 Stripe Test Cards

For testing payment processing:

- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **3D Secure**: `4000 0025 0000 3155`

Expiry: Any future date, CVC: Any 3 digits

## 🐛 Troubleshooting

**MongoDB Connection Error:**
```bash
# Check MongoDB is running
mongod --version

# Verify connection string in .env
# Local: mongodb://localhost:27017/dateclone
```

**Email not sending:**
```bash
# Check Gmail app password is correct (not regular password)
# Enable "Less secure apps" if using regular password
# 2FA must be enabled on Gmail account
```

**Stripe payment failing:**
```bash
# Verify STRIPE_SECRET_KEY starts with sk_test_
# Check Stripe account has correct API keys
# Test with provided test card numbers
```

## 📞 Support

For issues, check:
1. Console logs for error messages
2. MongoDB connection status
3. .env file configuration
4. API endpoint documentation above

## 📄 License

This project is proprietary. All rights reserved.

---

**Built with ❤️ for connecting hearts**
