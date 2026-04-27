import { homedir } from "node:os";
import { resolve } from "node:path";

const ENV_DIR = process.env.GALILEII_HOME;

export const galileiiHome = (): string =>
  ENV_DIR ? resolve(ENV_DIR) : resolve(homedir(), ".galileii");

export const profilePath = (): string => resolve(galileiiHome(), "profile.md");
export const wantsPath = (): string => resolve(galileiiHome(), "wants.md");
export const routinesPath = (): string => resolve(galileiiHome(), "routines.md");
export const placesPath = (): string => resolve(galileiiHome(), "places.md");
export const decisionsPath = (): string => resolve(galileiiHome(), "decisions.md");
export const configPath = (): string => resolve(galileiiHome(), "config.json");
export const envPath = (): string => resolve(galileiiHome(), ".env");
