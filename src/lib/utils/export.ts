import { CanvasBlockData } from '@/components/canvas/core/types';

export function exportTopicAsMarkdown(title: string, blocks: CanvasBlockData[]) {
  // Sort blocks by Y coordinate (top to bottom), then by X coordinate (left to right)
  const sortedBlocks = [...blocks].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 20) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  let markdown = `# ${title}\n\n`;

  for (const block of sortedBlocks) {
    if (block.type === 'text') {
      // Simple HTML to MD parsing
      let content = block.content || '';
      content = content.replace(/<p>/g, '').replace(/<\/p>/g, '\n\n');
      content = content.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
      content = content.replace(/<em>(.*?)<\/em>/g, '*$1*');
      content = content.replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n');
      content = content.replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n');
      content = content.replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n');
      content = content.replace(/<ul>/g, '').replace(/<\/ul>/g, '\n');
      content = content.replace(/<li>(.*?)<\/li>/g, '- $1\n');
      content = content.replace(/<br\s*\/?>/gi, '\n');
      
      // Strip remaining HTML tags
      content = content.replace(/<\/?[^>]+(>|$)/g, "");

      markdown += `${content.trim()}\n\n`;
    } else if (block.type === 'image') {
      const imgUrl = block.url || block.metadata?.sourceImages?.[0] || '';
      if (imgUrl) {
        markdown += `![Image](${imgUrl})\n\n`;
      }
    }
  }

  // Trigger download
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
