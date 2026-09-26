"use client";

import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useRef } from "react";

const nodes = [
  [80, 90, 4], [215, 65, 3], [340, 145, 5], [490, 70, 3], [625, 130, 4], [745, 50, 3],
  [120, 245, 3], [270, 270, 4], [430, 230, 7], [590, 300, 4], [735, 225, 5], [840, 315, 3],
  [70, 390, 4], [235, 415, 5], [405, 390, 3], [535, 455, 4], [700, 420, 3], [830, 470, 4],
];
const links = [[0,1],[0,6],[1,2],[1,7],[2,3],[2,7],[2,8],[3,4],[3,8],[4,5],[4,9],[4,10],[5,10],[6,7],[6,12],[7,8],[7,13],[8,9],[8,13],[8,14],[9,10],[9,14],[9,15],[10,11],[10,16],[11,17],[12,13],[13,14],[14,15],[15,16],[16,17]];

export function NeuralNetwork() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 });
  const y = useSpring(useMotionValue(0), { stiffness: 60, damping: 20 });
  return (
    <div ref={ref} className="neural-wrap" aria-hidden="true" onPointerMove={(event) => {
      if (reduced || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      x.set((event.clientX - rect.left - rect.width / 2) * .025);
      y.set((event.clientY - rect.top - rect.height / 2) * .025);
    }} onPointerLeave={() => { x.set(0); y.set(0); }}>
      <div className="network-halo" />
      <motion.svg style={{ x, y }} viewBox="0 0 900 540" role="presentation">
        <defs>
          <linearGradient id="argo-line" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#14B8FF" /><stop offset=".5" stopColor="#6070FF" /><stop offset="1" stopColor="#A855F7" /></linearGradient>
          <filter id="argo-glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g className="network-lines">{links.map(([a,b], i) => <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} pathLength="1" style={{ animationDelay: `${i * -0.17}s` }} />)}</g>
        <g>{nodes.map(([cx,cy,r], i) => <g key={i}><circle className="node-ring" cx={cx} cy={cy} r={r + 8} /><circle className="node-dot" cx={cx} cy={cy} r={r} style={{ animationDelay: `${i * -.21}s` }} /></g>)}</g>
        <g className="core-node"><circle cx="430" cy="230" r="45" /><circle cx="430" cy="230" r="28" /><text x="430" y="227">ARGO</text><text x="430" y="243">AI CORE</text></g>
      </motion.svg>
      <span className="network-label label-a">DOCUMENTS</span><span className="network-label label-b">DATABASES</span><span className="network-label label-c">KNOWLEDGE</span><span className="network-label label-d">ANALYTICS</span>
    </div>
  );
}
