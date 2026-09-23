// Port of the design prototype's makeConfetti()/celebrate().

const COLORS = ["#2ECC81", "#FF6A3D", "#F2F2F2", "#4E8A5B"];

export function makeConfetti(count = 44) {
  const pieces = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      left: Math.round(Math.random() * 96) + "vw",
      size: 6 + Math.round(Math.random() * 8),
      color: COLORS[i % COLORS.length],
      radius: i % 2 === 0 ? "50%" : "2px",
      duration: (1.6 + Math.random() * 1.2).toFixed(2),
      delay: (Math.random() * 0.6).toFixed(2),
    });
  }
  return pieces;
}
