// Environment variable validation at startup
// Ensures all required variables are present before the app starts

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  {
    name: "DATABASE_URL",
    required: true,
    description: "PostgreSQL database connection string",
    validator: (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
  },
  {
    name: "NEXTAUTH_URL",
    required: true,
    description: "Next.js application URL",
    validator: (value) => value.startsWith("http://") || value.startsWith("https://"),
  },
  {
    name: "NEXTAUTH_SECRET",
    required: true,
    description: "Secret key for NextAuth.js session encryption",
    validator: (value) => value.length >= 32,
  },
  {
    name: "GOOGLE_API_KEY",
    required: true,
    description: "Google Gemini API key for AI features",
    validator: (value) => value.startsWith("AIza"),
  },
];

export function validateEnvironment(): void {
  const errors: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      errors.push(
        `Missing required environment variable: ${envVar.name} (${envVar.description})`
      );
      continue;
    }

    if (value && envVar.validator && !envVar.validator(value)) {
      errors.push(
        `Invalid value for environment variable: ${envVar.name} (${envVar.description})`
      );
    }
  }

  if (errors.length > 0) {
    console.error("Environment validation failed:");
    errors.forEach((error) => console.error(`  - ${error}`));
    
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
}

// Run validation immediately when module is imported
if (typeof window === "undefined") {
  validateEnvironment();
}
