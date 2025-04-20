/**
 * Gets today's date in YYYY-MM-DD format.
 * @returns Today's date string.
 */
export const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Formats an ISO date string to YYYY-MM-DD.
 * @param isoDateString The ISO date string.
 * @returns The formatted date string or the original string if formatting fails.
 */
export const formatDate = (isoDateString: string): string => {
  try {
    return isoDateString.split('T')[0]; // Extract YYYY-MM-DD
  } catch {
    return isoDateString; // Fallback
  }
};

/**
 * Gets the previous day's date in YYYY-MM-DD format.
 * @param dateString The current date string (YYYY-MM-DD).
 * @returns The previous day's date string.
 */
export const getPreviousDay = (dateString: string): string => {
  const date = new Date(dateString);
  // Adjust for timezone offset before calculation to avoid skipping days near midnight UTC
  const timezoneOffsetMinutes = date.getTimezoneOffset();
  date.setMinutes(date.getMinutes() - timezoneOffsetMinutes); 
  date.setDate(date.getDate() - 1);
  // Adjust back after calculation if needed, though ISOString should handle it
  // date.setMinutes(date.getMinutes() + timezoneOffsetMinutes);
  return date.toISOString().split('T')[0];
}; 