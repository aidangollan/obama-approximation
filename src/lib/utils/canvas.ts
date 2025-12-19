/**
 * Render a grayscale Uint8Array to a canvas as an ImageData object
 * @param canvas Target canvas element
 * @param grayscaleData Uint8Array containing grayscale values (0-255)
 * @param width Image width
 * @param height Image height
 */
export function renderGrayscaleToCanvas(
  canvas: HTMLCanvasElement,
  grayscaleData: Uint8Array,
  width: number,
  height: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Create ImageData
  const imageData = ctx.createImageData(width, height)
  const data = imageData.data

  // Convert grayscale to RGBA
  for (let i = 0; i < grayscaleData.length; i++) {
    const gray = grayscaleData[i]
    const idx = i * 4
    data[idx] = gray     // R
    data[idx + 1] = gray // G
    data[idx + 2] = gray // B
    data[idx + 3] = 255  // A
  }

  // Put image data on canvas
  ctx.putImageData(imageData, 0, 0)
}

