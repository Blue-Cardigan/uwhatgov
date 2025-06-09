// Helper function to escape regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to highlight search matches in HTML
function highlightSearchInHtml(html: string, query: string): string {
  if (!query || !html) return html;
  
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  // Avoid highlighting inside HTML tags
  const parts = html.split(/(<[^>]*>)/); // Split by tags
  
  return parts.map(part => {
    if (part.startsWith('<') && part.endsWith('>')) {
      return part; // Keep tags as is
    } else {
      // Highlight text content
      return part.replace(regex, `<mark class="bg-yellow-400 text-black rounded px-0.5">$1</mark>`);
    }
  }).join('');
}

export function parseMarkdown(text: string, searchQuery?: string): string {
  if (!text) return '';

  let html = text;

  // Headers (# ## ###)
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-2 mt-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mb-2 mt-4">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mb-3 mt-4">$1</h1>');

  // Bold (**text**) - Use placeholder to avoid conflicts
  html = html.replace(/\*\*(.*?)\*\*/g, '___BOLD_START___$1___BOLD_END___');

  // Italic (*text*)
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

  // Replace bold placeholders
  html = html.replace(/___BOLD_START___(.*?)___BOLD_END___/g, '<strong class="font-semibold">$1</strong>');

  // Strikethrough (~text~)
  html = html.replace(/~(.*?)~/g, '<del class="line-through opacity-75">$1</del>');

  // Process lists and quotes line by line
  const lines = html.split('\n');
  const processedLines: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;
  let inQuote = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Unordered list (* item)
    if (trimmedLine.startsWith('* ')) {
      if (!inUnorderedList) {
        processedLines.push('<ul class="list-disc list-inside ml-4 mb-2">');
        inUnorderedList = true;
      }
      processedLines.push(`<li class="mb-1">${trimmedLine.substring(2)}</li>`);
    }
    // Ordered list (1. item)
    else if (/^\d+\.\s/.test(trimmedLine)) {
      if (!inOrderedList) {
        processedLines.push('<ol class="list-decimal list-inside ml-4 mb-2">');
        inOrderedList = true;
      }
      const content = trimmedLine.replace(/^\d+\.\s/, '');
      processedLines.push(`<li class="mb-1">${content}</li>`);
    }
    // Quote (> text)
    else if (trimmedLine.startsWith('> ')) {
      if (!inQuote) {
        processedLines.push('<blockquote class="border-l-4 border-gray-500 pl-4 ml-2 mb-2 italic opacity-80">');
        inQuote = true;
      }
      processedLines.push(`<p class="mb-1">${trimmedLine.substring(2)}</p>`);
    }
    // Regular line
    else {
      // Close any open lists or quotes
      if (inUnorderedList) {
        processedLines.push('</ul>');
        inUnorderedList = false;
      }
      if (inOrderedList) {
        processedLines.push('</ol>');
        inOrderedList = false;
      }
      if (inQuote) {
        processedLines.push('</blockquote>');
        inQuote = false;
      }

      // Add regular line (convert single line breaks to <br> if not empty)
      if (trimmedLine === '') {
        processedLines.push('<br>');
      } else {
        processedLines.push(`<p class="mb-2">${line}</p>`);
      }
    }
  }

  // Close any remaining open tags
  if (inUnorderedList) {
    processedLines.push('</ul>');
  }
  if (inOrderedList) {
    processedLines.push('</ol>');
  }
  if (inQuote) {
    processedLines.push('</blockquote>');
  }

  const finalHtml = processedLines.join('\n');

  // Apply search highlighting if query is provided
  return searchQuery ? highlightSearchInHtml(finalHtml, searchQuery) : finalHtml;
} 