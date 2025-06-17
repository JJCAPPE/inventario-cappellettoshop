/**
 * Utility for accessing location information
 */

/**
 * Get the primary location name
 */
export const getPrimaryLocationName = (): string => {
  // Treviso is the primary location
  return "Treviso";
};

/**
 * Get the secondary location name
 */
export const getSecondaryLocationName = (): string => {
  return "Mogliano";
};

/**
 * Get all available locations
 */
export const getAllLocations = (): Array<{
  id: string;
  name: string;
  isPrimary: boolean;
}> => {
  return [
    { id: "treviso", name: "Treviso", isPrimary: true },
    { id: "mogliano", name: "Mogliano", isPrimary: false },
  ];
};

/**
 * Get formatted location display text
 */
export const getLocationDisplayText = (): string => {
  const primary = getPrimaryLocationName();
  const secondary = getSecondaryLocationName();
  return `${primary} (Principale) • ${secondary}`;
};

export default {
  getPrimaryLocationName,
  getSecondaryLocationName,
  getAllLocations,
  getLocationDisplayText,
};
