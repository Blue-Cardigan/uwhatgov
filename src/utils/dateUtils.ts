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

// Helper function to get the ordinal suffix for a day number (e.g., 1st, 2nd, 3rd, 4th)
const getDaySuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th'; // Special case for 11th-13th
  switch (day % 10) {
    case 1:  return "st";
    case 2:  return "nd";
    case 3:  return "rd";
    default: return "th";
  }
};

/**
 * Formats a date string (YYYY-MM-DD or ISO) into a verbose format.
 * Example: "Tuesday 23rd July" or "Tuesday 23rd July 2023" if the year is not the current year.
 * @param dateString The date string to format.
 * @returns The formatted verbose date string or the original string if formatting fails.
 */
export const formatDateVerbose = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    // Adjust for potential timezone issues if the input is just YYYY-MM-DD
    if (dateString.length === 10) {
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    }

    const dayOfWeek = date.toLocaleDateString('en-GB', { weekday: 'long' });
    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'long' });
    const year = date.getFullYear();
    const currentYear = new Date().getFullYear();

    const dayWithSuffix = `${day}${getDaySuffix(day)}`;

    if (year === currentYear) {
      return `${dayOfWeek} ${dayWithSuffix} ${month}`;
    } else {
      return `${dayOfWeek} ${dayWithSuffix} ${month} ${year}`;
    }
  } catch (error) {
    console.error("Error formatting date:", error);
    return dateString; // Fallback to the original string on error
  }
}; 