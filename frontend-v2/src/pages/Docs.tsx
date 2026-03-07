import React, { useState, useEffect } from 'react';

export function Docs() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/docs/getting-started.md')
      .then((res) => res.text())
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    const html: string[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          html.push(`<pre class="docs-code"><code>${codeBuffer.join('\n').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`);
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }
      if (inCodeBlock) { codeBuffer.push(line); continue; }

      let processed = line;
      if (processed.startsWith('# ')) { html.push(`<h1 class="docs-h1">${processed.slice(2)}</h1>`); continue; }
      if (processed.startsWith('## ')) { html.push(`<h2 class="docs-h2">${processed.slice(3)}</h2>`); continue; }
      if (processed.startsWith('### ')) { html.push(`<h3 class="docs-h3">${processed.slice(4)}</h3>`); continue; }
      if (processed.match(/^---+$/)) { html.push('<hr class="docs-hr" />'); continue; }
      if (processed.trim() === '') { html.push('<div class="docs-spacer"></div>'); continue; }

      if (processed.startsWith('- ')) processed = processed.slice(2);

      processed = processed
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="docs-inline-code">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="docs-link" target="_blank" rel="noopener">$1</a>');

      if (line.startsWith('- ')) {
        html.push(`<div class="docs-list-item">• ${processed}</div>`);
      } else {
        html.push(`<p class="docs-p">${processed}</p>`);
      }
    }
    return html.join('\n');
  };

  return (
    <div className="docs-page">
      <div className="docs-container">
        {loading ? (
          <div className="docs-loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <div
            className="docs-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
    </div>
  );
}
