/**
 * QR Inception Overlay — renders an Aura SVG to canvas with a real scannable QR
 * embedded in the bottom-left corner (replacing the decorative QR anchor).
 * 
 * Requires qrcode.min.js loaded first.
 * 
 * Usage:
 *   renderAuraWithQR(svgString, size, qrUrl, agentHue) → Promise<HTMLCanvasElement>
 *   overlayQROnCanvas(canvas, size, qrUrl, agentHue) — draws QR onto existing canvas
 */

function renderAuraWithQR(svgString, size, qrUrl, agentHue) {
  return new Promise(function(resolve) {
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    
    var img = new Image();
    var blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    
    img.onload = function() {
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      overlayQROnCanvas(canvas, size, qrUrl, agentHue);
      resolve(canvas);
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.src = url;
  });
}

function overlayQROnCanvas(canvas, size, qrUrl, agentHue) {
  if (typeof qrcode === 'undefined') return;
  if (!qrUrl) return;
  
  var ctx = canvas.getContext('2d');
  var qr = qrcode(0, 'H');
  qr.addData(qrUrl);
  qr.make();
  
  var moduleCount = qr.getModuleCount();
  var cellPx = size / 25; // 25x25 aura grid
  var anchorSize = Math.floor(cellPx * 7);
  var anchorX = 0;
  var anchorY = Math.floor(cellPx * 18); // bottom-left anchor starts at row 18
  
  var borderWidth = 2;
  var padding = 3;
  var qrX = anchorX + borderWidth + padding;
  var qrY = anchorY + borderWidth + padding;
  var qrSize = anchorSize - (borderWidth + padding) * 2;
  var cellSize = qrSize / moduleCount;
  
  var hue = agentHue || 0;
  var frameColor = 'hsl(' + hue + ', 65%, 45%)';
  var dotColor = 'hsl(' + hue + ', 65%, 55%)';
  
  // Dark background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(anchorX, anchorY, anchorSize, anchorSize);
  
  // Border frame
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(anchorX + borderWidth/2, anchorY + borderWidth/2, anchorSize - borderWidth, anchorSize - borderWidth);
  
  // QR modules
  for (var row = 0; row < moduleCount; row++) {
    for (var col = 0; col < moduleCount; col++) {
      if (qr.isDark(row, col)) {
        ctx.fillStyle = dotColor;
        ctx.fillRect(
          qrX + col * cellSize,
          qrY + row * cellSize,
          Math.ceil(cellSize),
          Math.ceil(cellSize)
        );
      }
    }
  }
}
