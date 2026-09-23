// Port of the design prototype's spinWheel() math: picks a random winner index,
// then computes a rotation that lands that segment under the fixed top pointer
// after 10 full spins (doubled from the original 5, to match SPIN_DURATION_MS
// below also being doubled -- keeps the same angular speed, just spins longer).

export const SPIN_DURATION_MS = 6400;
const SPIN_TURNS = 10;

export function computeSpin(poolLength) {
  const winnerIdx = Math.floor(Math.random() * poolLength);
  const segmentAngle = 360 / poolLength;
  const centerAngle = winnerIdx * segmentAngle + segmentAngle / 2;
  const rotation = SPIN_TURNS * 360 + (360 - centerAngle);
  return { winnerIdx, rotation };
}

export function wheelGradient(poolLength, accentColor, surfaceColor) {
  const n = poolLength || 1;
  const deg = 360 / n;
  const stops = [];
  for (let i = 0; i < n; i++) {
    const c = i % 2 === 0 ? accentColor : surfaceColor;
    stops.push(`${c} ${i * deg}deg ${(i + 1) * deg}deg`);
  }
  return `conic-gradient(${stops.join(",")})`;
}
