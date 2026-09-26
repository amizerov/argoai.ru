const left = ["Documents", "Databases", "E-mail", "ERP / 1C", "Web services", "University systems"];
const orbit = ["LLM", "Embeddings", "RAG", "Vector Search", "Agents", "MCP", "Knowledge Graph"];
const right = ["Semantic Search", "AI Assistant", "Analytics", "Automation", "Knowledge Base"];

export function DataFlow() {
  return <div className="dataflow" aria-label="Архитектура платформы ARGO AI">
    <div className="flow-column flow-sources"><span className="flow-heading">ИСТОЧНИКИ</span>{left.map((item) => <span key={item}>{item}</span>)}</div>
    <div className="flow-stage">
      <svg viewBox="0 0 560 390" aria-hidden="true"><defs><linearGradient id="flow-gradient"><stop stopColor="#14b8ff"/><stop offset="1" stopColor="#a855f7"/></linearGradient></defs>{Array.from({length: 12}).map((_,i) => <path key={i} className="flow-line" style={{animationDelay: `${i * -.25}s`}} d={`M 0 ${35 + i*27} C 170 ${35+i*17}, 390 ${355-i*21}, 560 ${45+i*25}`} />)}</svg>
      <div className="flow-core"><span>ARGO</span><strong>AI CORE</strong><small>INTELLIGENCE LAYER</small></div>
      <div className="orbit">{orbit.map((item, i) => <span key={item} style={{ "--i": i } as React.CSSProperties}>{item}</span>)}</div>
    </div>
    <div className="flow-column flow-output"><span className="flow-heading">РЕЗУЛЬТАТ</span>{right.map((item) => <span key={item}>{item}</span>)}</div>
  </div>;
}
