/**
 * Utility for accessing the application version from environment variables
 */

/**
 * Get the current application version from VITE_VERSION environment variable
 * Falls back to "3.0.0" if not set
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

export default {
  getAppVersion,
  getDisplayVersion,
  isDevelopmentVersion,
};
