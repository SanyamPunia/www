// Environment configuration for envt
// This file defines your CLIENT-SIDE environment variables with types and validation rules
// Only use variables that are accessible on the client-side (NEXT_PUBLIC_*, PUBLIC_*, VITE_*, REACT_APP_*)

export const config = {
  NEXT_PUBLIC_BASE_URL: {
    type: "string",
    required: true,
    description: "base url",
  },
};
