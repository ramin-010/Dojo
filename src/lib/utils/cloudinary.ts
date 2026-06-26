/**
 * Extracts the Cloudinary public_id from a standard Cloudinary URL.
 * Example URL: https://res.cloudinary.com/dsfb3jjqx/image/upload/v1782210140/revise-uploads/i8albimxh20vtqyddn4x.webp
 * Returns: revise-uploads/i8albimxh20vtqyddn4x
 */
export function extractCloudinaryPublicId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('res.cloudinary.com')) return null;

  try {
    // We want everything after /upload/ (and optionally /v1234/) 
    // up to the last dot (the file extension).
    const uploadIndex = url.indexOf('/upload/');
    if (uploadIndex === -1) return null;

    let pathAfterUpload = url.substring(uploadIndex + '/upload/'.length);

    // Remove the version string if it exists (e.g., v1782210140/)
    if (pathAfterUpload.match(/^v\d+\//)) {
      pathAfterUpload = pathAfterUpload.replace(/^v\d+\//, '');
    }

    // Remove the file extension
    const lastDotIndex = pathAfterUpload.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      pathAfterUpload = pathAfterUpload.substring(0, lastDotIndex);
    }

    return pathAfterUpload;
  } catch (e) {
    console.error('Error extracting Cloudinary public_id from URL:', url, e);
    return null;
  }
}
