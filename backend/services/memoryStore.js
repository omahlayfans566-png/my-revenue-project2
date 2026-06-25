/**
 * memoryStore.js
 * 
 * In-memory fallback used when MongoDB is unreachable (e.g. port 27017 blocked).
 * Data lives only while the server process is running — it is NOT persisted.
 * 
 * When MongoDB connects, all real routes use the Mongoose models instead.
 * This store is ONLY used by authRoutes when DB state !== 1 (connected).
 */

import bcrypt from "bcryptjs";

const users = new Map();  // email → user object
const byId = new Map();  // _id   → user object
const byUser = new Map();  // username → user object

let _idCounter = 1;

const makeId = () => `mem_${Date.now()}_${_idCounter++}`;

// ── User operations ──────────────────────────────────────────────────────────

export const memFindByEmail = (email) =>
    users.get(email.toLowerCase()) ?? null;

export const memFindById = (id) =>
    byId.get(id) ?? null;

export const memFindByUsername = (username) =>
    byUser.get(username.toLowerCase()) ?? null;

export const memCreateUser = async (data) => {
    const id = makeId();
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(data.password, salt);

    const user = {
        _id: id,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        username: (data.username || "").toLowerCase(),
        email: (data.email || "").toLowerCase(),
        phone: data.phone || "",
        password: hash,
        dateOfBirth: data.dateOfBirth || null,
        age: data.age || 0,
        gender: data.gender || "",
        lookingFor: data.lookingFor || "",
        country: data.country || "",
        state: data.state || "",
        city: data.city || "",
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        profilePicture: data.profilePicture || "",
        aboutMe: data.aboutMe || "",
        occupation: data.occupation || "",
        education: data.education || "",
        languages: data.languages || [],
        interests: data.interests || [],
        smoking: data.smoking || "",
        drinking: data.drinking || "",
        minAge: data.minAge || 18,
        maxAge: data.maxAge || 50,
        preferredCountry: data.preferredCountry || "",
        preferredDistance: data.preferredDistance || "",
        relationshipGoal: data.relationshipGoal || "",
        hasChildren: data.hasChildren || "",
        wantsChildren: data.wantsChildren || "",
        religion: data.religion || "",
        religionImportance: data.religionImportance || "",
        relationshipValue: data.relationshipValue || "",
        emailVerified: false,
        verificationToken: data.verificationToken || "",
        verificationTokenExpires: data.verificationTokenExpires || null,
        isMember: false,
        isActive: false,
        isBanned: false,
        profileCompletion: 60,
        isPremium: false,
        premiumTier: "basic",
        lastLogin: null,
        createdAt: new Date(),
    };

    users.set(user.email, user);
    byId.set(user._id, user);
    byUser.set(user.username, user);
    return user;
};

export const memVerifyUser = (email, otp) => {
    const user = users.get(email.toLowerCase());
    if (!user) return null;
    if (user.verificationToken !== otp) return null;
    if (user.verificationTokenExpires && new Date() > new Date(user.verificationTokenExpires)) return null;

    user.emailVerified = true;
    user.isMember = true;
    user.isActive = true;
    user.verificationToken = "";
    user.verificationTokenExpires = null;
    return user;
};

export const memCheckPassword = async (email, password) => {
    const user = users.get(email.toLowerCase());
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.password);
    return ok ? user : null;
};

export const memUpdateVerificationToken = (email, token, expires) => {
    const user = users.get(email.toLowerCase());
    if (!user) return false;
    user.verificationToken = token;
    user.verificationTokenExpires = expires;
    return true;
};

export const isMemoryMode = () => true;
