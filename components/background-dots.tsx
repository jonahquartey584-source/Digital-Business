/**
 * Decorative gold node/line network + orbit ring, matching the hero
 * background on qp-digital.netlify.app. Pure SVG, absolutely positioned,
 * non-interactive — safe to drop behind any dark section.
 */
export function BackgroundDots({ className = "" }: { className?: string }) {
  const nodes: [number, number][] = [
    [80, 320], [230, 140], [420, 60], [610, 210],
    [760, 90], [900, 260], [980, 460], [840, 560],
    [660, 480], [500, 560], [340, 460], [160, 540],
  ];
  const edges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
    [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0],
    [1, 3], [8, 5],
  ];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <defs>
          <radialGradient id="qp-orb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#B07B2E" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#B07B2E" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="880" cy="420" r="260" fill="url(#qp-orb)" />
        <circle
          cx="880"
          cy="420"
          r="220"
          fill="none"
          stroke="#D9AF63"
          strokeOpacity="0.18"
        />
        <circle
          cx="880"
          cy="420"
          r="320"
          fill="none"
          stroke="#D9AF63"
          strokeOpacity="0.1"
        />

        {edges.map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            stroke="#D9AF63"
            strokeOpacity="0.25"
            strokeWidth="1"
          />
        ))}

        {nodes.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 4 : 2.5} fill="#D9AF63" fillOpacity="0.6" />
        ))}
      </svg>
    </div>
  );
}
