// Environment configuration for envt
// This file defines your CLIENT-SIDE environment variables with types and validation rules
// Only use variables that are accessible on the client-side (NEXT_PUBLIC_*, PUBLIC_*, VITE_*, REACT_APP_*)

export const config = {
  NEXT_PUBLIC_BASE_URL: {
    type: "string",
    required: true,
    description: "base url",
  },
  NEXT_PUBLIC_FIREBASE_API_KEY: {
    type: "string",
    required: true,
    description: "firebase api key",
  },
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: {
    type: "string",
    required: true,
    description: "firebase auth domain",
  },
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: {
    type: "string",
    required: true,
    description: "firebase project id",
  },
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: {
    type: "string",
    required: true,
    description: "firebase storage bucket",
  },
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: {
    type: "string",
    required: true,
    description: "firebase messaging sender id",
  },
  NEXT_PUBLIC_FIREBASE_APP_ID: {
    type: "string",
    required: true,
    description: "firebase app id",
  },
};
