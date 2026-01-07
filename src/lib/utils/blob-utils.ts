export function createBlobFromUint8Array(data: Uint8Array, mimeType: string): Blob {
  // Ensure compatibility across different environments
  try {
    return new Blob([data as any], { type: mimeType });
  } catch (e) {
    // Fallback for older environments
    const buffer = new ArrayBuffer(data.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < data.length; i++) {
      view[i] = data[i];
    }
    return new Blob([buffer], { type: mimeType });
  }
}