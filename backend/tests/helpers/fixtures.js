/**
 * fixtures.js — Shared test data factories
 */
import crypto from "crypto";

const ts = () => crypto.randomBytes(4).toString("hex");

export const makeUser = (overrides = {}) => {
    const id = ts();
    return {
        firstName: "Test",
        lastName: "User" + id,
        username: `testuser_${id}`,
        email: `test_${id}@jest-dateclone.test`,
        password: "TestPass@123",
        confirmPassword: "TestPass@123",
        dateOfBirth: "1995-06-15",
        gender: "male",
        lookingFor: "women",
        country: "Nigeria",
        state: "Lagos State",
        city: "Lagos",
        profilePicture: "",
        aboutMe: "Jest test user — auto-generated for integration tests.",
        occupation: "Engineer",
        education: "bachelors",
        languages: ["English"],
        interests: ["Music", "Travel"],
        smoking: "never",
        drinking: "socially",
        relationshipGoal: "Serious relationship",
        hasChildren: "no",
        wantsChildren: "yes",
        religion: "Christian",
        religionImportance: "somewhat_important",
        relationshipValue: "trust",
        minAge: 18,
        maxAge: 50,
        preferredCountry: "Anywhere in Africa",
        preferredDistance: "anywhere_in_africa",
        ...overrides,
    };
};

export const makeFemaleUser = (overrides = {}) =>
    makeUser({ gender: "female", lookingFor: "men", ...overrides });
