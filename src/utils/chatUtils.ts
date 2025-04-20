/**
 * Extracts the base speaker name from a string, attempting to remove
 * party affiliations, constituencies, and titles in parentheses.
 * @param speakerString The raw speaker string from the data.
 * @returns The extracted base name or 'Unknown Speaker'.
 */
export function getBaseSpeakerName(speakerString: string): string {
    if (!speakerString) return 'Unknown Speaker';

    let name = speakerString.trim();
    // TODO: Consider making this list dynamic or loading from a config
    const knownParties = ['Con', 'DUP', 'Lab', 'LD', 'PC', 'UUP', 'Ind', 'SNP', 'CB'];

    const lastParenMatch = name.match(/\s*\(([^)]+)\)$/);

    if (lastParenMatch) {
        const lastContent = lastParenMatch[1].trim();
        const potentialParty = lastContent.split('/')[0].trim(); // Handle cases like (Lab/Co-op)
        const nameBeforeLastParen = name.substring(0, lastParenMatch.index).trim();
        const secondLastParenMatch = nameBeforeLastParen.match(/\s*\(([^)]+)\)$/);

        // Case 1: Last paren content IS a known party
        if (knownParties.includes(potentialParty)) {
            name = nameBeforeLastParen;
            // If there was another paren before it (likely constituency), remove that too
            if (secondLastParenMatch) {
                name = name.substring(0, secondLastParenMatch.index).trim();
            }
        } 
        // Case 2: Last paren content is NOT a party, but there IS a paren before it
        else if (secondLastParenMatch) {
            // Assume format: Name (Constituency) (Something Else - like role)
            // The base name is before the constituency
            name = nameBeforeLastParen.substring(0, secondLastParenMatch.index).trim();
        } 
        // Case 3: Last paren content is NOT a party, and NO paren before it
        else {
            // Could be: Title (Actual Name) or Name (Title)
            // Attempt to handle 'The Lord Speaker (Lord McFall of Alcluith)' -> 'Lord McFall of Alcluith'
            // Or handle 'First Minister (Humza Yousaf)' -> 'Humza Yousaf'
            // It's ambiguous, but extracting from the last parenthesis is a reasonable heuristic
            name = lastContent;
        }
    } 
    // Case 4: No parentheses at all - name remains the original trimmed string

    return name || 'Unknown Speaker'; // Return the processed name or fallback
} 