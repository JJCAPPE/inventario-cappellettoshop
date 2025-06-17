/**
 * Utility for accessing the application version from environment variables
 */

/**
 * Get the current application version from VITE_VERSION environment variable
 * Falls back to "3.0.1" if not set
 */
export const getAppVersion = (): string => {
  return import.meta.env.VITE_VERSION;
};

/**
 * Get the current application version with 'v' prefix for display
 */
export const getDisplayVersion = (): string => {
  return `v${getAppVersion()}`;
};

/**
 * Check if the app version is a development version
 */
export const isDevelopmentVersion = (): boolean => {
  const version = getAppVersion();
  return (
    version.includes("dev") ||
    version.includes("beta") ||
    version.includes("alpha")
  );
};

/**
 * Get the build date (automatically set during CI/CD)
 */
export const getBuildDate = (): string => {
  return import.meta.env.VITE_BUILD_DATE || "Sconosciuto";
};

/**
 * Get the build time (automatically set during CI/CD)
 */
export const getBuildTime = (): string => {
  return import.meta.env.VITE_BUILD_TIME || "Sconosciuto";
};

/**
 * Get the git commit hash (automatically set during CI/CD)
 */
export const getCommitHash = (): string => {
  return import.meta.env.VITE_COMMIT_HASH || "Sconosciuto";
};

/**
 * Get the build environment
 */
export const getBuildEnvironment = (): string => {
  return import.meta.env.VITE_BUILD_ENV || "development";
};

/**
 * Check if this is a production build
 */
export const isProduction = (): boolean => {
  return import.meta.env.PROD;
};

/**
 * Get formatted build information
 */
export const getBuildInfo = (): string => {
  const date = getBuildDate();
  const time = getBuildTime();
  if (date === "Sconosciuto" || time === "Sconosciuto") {
    return "Informazioni build non disponibili";
  }
  return `${date} alle ${time}`;
};

export default {
  getAppVersion,
  getDisplayVersion,
  isDevelopmentVersion,
  getBuildDate,
  getBuildTime,
  getCommitHash,
  getBuildEnvironment,
  isProduction,
  getBuildInfo,
};
