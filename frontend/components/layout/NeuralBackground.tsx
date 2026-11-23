type Node = { x: number; y: number; r: number; delay: number };

const NODES: Node[] = Array.from({ length: 26 }, (_, i) => ({
  x: 40 + ((i * 137) % 1120),
  y: 50 + ((i * 211) % 700),
  r: 1.4 + ((i * 7) % 4) * 0.5,
  delay: (i % 8) * 0.7,
}));

const EDGES: Array<[Node, Node]> = [];
for (let i = 0; i < NODES.length; i += 1) {
  for (let j = i + 1; j < NODES.length; j += 1) {
    const a = NODES[i];
    const b = NODES[j];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 230 && EDGES.length < 42) EDGES.push([a, b]);
  }
}

const PACKETS = EDGES.slice(0, 6);

export default function NeuralBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-lime-500/10 blur-[120px] animate-drift" />
      <div
        className="absolute -right-32 top-10 h-[460px] w-[460px] rounded-full bg-mango-500/10 blur-[120px] animate-drift"
        style={{ animationDelay: "-7s" }}
      />
      <div
        className="absolute bottom-[-180px] left-1/3 h-[520px] w-[520px] rounded-full bg-mint-400/[0.07] blur-[130px] animate-drift"
        style={{ animationDelay: "-14s" }}
      />

      <div className="absolute inset-0 bg-grid-faint bg-grid opacity-[0.5] [mask-image:radial-gradient(80%_60%_at_50%_20%,black,transparent)]" />

      <svg
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full opacity-40"
      >
        <g stroke="#A3E635" strokeOpacity="0.13" strokeWidth="1">
          {EDGES.map(([a, b], i) => (
            <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          ))}
        </g>
        {NODES.map((node, i) => (
          <circle key={i} cx={node.x} cy={node.y} r={node.r} fill="#D6FF9B" fillOpacity="0.6">
            <animate
              attributeName="fill-opacity"
              values="0.18;0.85;0.18"
              dur={`${5 + (i % 5)}s`}
              begin={`${node.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values={`${node.r};${node.r * 1.8};${node.r}`}
              dur={`${6 + (i % 4)}s`}
              begin={`${node.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
        {PACKETS.map(([a, b], i) => (
          <circle key={`p-${i}`} r="2.6" fill="#5EEAD4">
            <animateMotion
              dur={`${7 + i * 1.6}s`}
              begin={`${i * 1.1}s`}
              repeatCount="indefinite"
              path={`M${a.x} ${a.y} L${b.x} ${b.y}`}
            />
            <animate
              attributeName="opacity"
              values="0;1;0.9;0"
              dur={`${7 + i * 1.6}s`}
              begin={`${i * 1.1}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
    </div>
  );
}
