/**
 * Escapes special characters in a string for use in a regular expression.
 * @param string The input string.
 * @returns The string with regex special characters escaped.
 */
export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\\\]]/g, '\\$&'); // $& means the whole matched string
} 