/**
 * Parses the party abbreviation from a speaker's name string.
 * Handles formats like "Name (Constituency) (Party)" or "Name (Party)".
 * Also handles multi-party affiliations like (Lab/Co-op), taking the first part.
 * @param speakerName The full name string of the speaker.
 * @returns The party abbreviation (e.g., "Lab", "Con") or null if not found.
 */
export const parsePartyAbbreviation = (speakerName: string | null): string | null => {
  if (!speakerName) return null;

  // Match the last parentheses group
  const partyMatch = speakerName.match(/\(([^)]+)\)$/);
  if (!partyMatch || !partyMatch[1]) return null;

  // Take the part before any potential slash (e.g., "Lab" from "Lab/Co-op")
  return partyMatch[1].split('/')[0].trim();
};

/**
 * Returns a Tailwind CSS text color class based on the party abbreviation.
 * @param partyAbbreviation The party abbreviation (e.g., "Lab", "Con").
 * @returns Tailwind CSS class string (e.g., "text-red-400").
 */
export const getPartyColorClass = (partyAbbreviation: string | null): string => {
  switch (partyAbbreviation) {
    case 'Con':
    case 'Conservative':
      return 'bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent'; // Conservative Gradient
    case 'DUP':
      return 'bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent'; // DUP Gradient
    case 'Lab':
    case 'Labour':
      return 'bg-gradient-to-r from-red-400 to-red-500 bg-clip-text text-transparent'; // Labour Gradient
    case 'LD':
    case 'Liberal Democrat':
      return 'bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent'; // Liberal Democrat Gradient
    case 'PC':
      return 'bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent'; // Plaid Cymru Gradient
    case 'UUP':
      return 'bg-gradient-to-r from-purple-400 to-purple-500 bg-clip-text text-transparent'; // Ulster Unionist Party Gradient
    case 'Ind':
    case 'Independent':
      return 'bg-gradient-to-r from-orange-800 to-orange-600 bg-clip-text text-transparent'; // Independent Gradient
    case 'SNP':
      return 'bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent'; // Scottish National Party Gradient
    case 'CB':
      return 'bg-gradient-to-r from-red-400 to-blue-400 bg-clip-text text-transparent'; // Crossbench Gradient
    // Add more parties and colors as needed
    default:
      return 'text-gray-400'; // Default fallback color for unknown/no party
  }
};

/**
 * Combines parsing and color lookup for direct use with speaker names.
 * @param speakerName The full name string of the speaker.
 * @returns Tailwind CSS class string.
 */
export const getPartyColorClassFromName = (speakerName: string | null): string => {
  const partyAbbreviation = parsePartyAbbreviation(speakerName);
  return getPartyColorClass(partyAbbreviation);
};

// Mapping for SVG fill colors (similar to text colors but using hex or CSS vars if needed)
// Using simple Tailwind color names for now, assuming they correspond to available fills or strokes
export const getPartySvgFill = (partyAbbreviation: string | null): string => {
  switch (partyAbbreviation) {
    case 'Con':
    case 'Conservative':
      return '#60a5fa'; // blue-400
    case 'DUP':
      return '#fb923c'; // orange-400
    case 'Lab':
    case 'Labour':
      return '#f87171'; // red-400
    case 'LD':
    case 'Liberal Democrat':
      return '#facc15'; // yellow-400
    case 'PC':
      return '#4ade80'; // green-400
    case 'UUP':
      return '#c084fc'; // purple-400
    case 'Ind':
      return '#9ca3af'; // gray-400
    case 'SNP':
      return '#facc15'; // yellow-400
    case 'CB':
      return '#fb923c'; // orange-400
    default:
      return '#9ca3af'; // gray-400 (slightly different default for fill)
  }
}; 