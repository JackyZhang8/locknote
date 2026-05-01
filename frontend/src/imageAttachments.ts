export const ATTACHMENT_URI_PREFIX = 'locknote-attachment://';

export interface AttachmentReference {
  id: string;
  originalName?: string;
}

export function parseAttachmentId(src: string | undefined): string | null {
  if (!src?.startsWith(ATTACHMENT_URI_PREFIX)) {
    return null;
  }
  const id = src.slice(ATTACHMENT_URI_PREFIX.length).trim();
  return id || null;
}

export function attachmentMarkdown(attachment: AttachmentReference): string {
  const alt = attachment.originalName?.trim() || 'image';
  return `![${alt}](${ATTACHMENT_URI_PREFIX}${attachment.id})`;
}

export function markdownUrlTransform(value: string): string {
  if (parseAttachmentId(value)) {
    return value;
  }

  const colon = value.indexOf(':');
  const questionMark = value.indexOf('?');
  const numberSign = value.indexOf('#');
  const slash = value.indexOf('/');
  const protocol = colon >= 0 ? value.slice(0, colon) : '';

  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    /^(https?|ircs?|mailto|xmpp)$/i.test(protocol)
  ) {
    return value;
  }

  return '';
}

export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('failed to read image data'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('failed to read image data'));
    reader.readAsDataURL(file);
  });
}
