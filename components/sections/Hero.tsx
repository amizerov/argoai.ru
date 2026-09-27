import { ArrowDown } from "lucide-react";
import { ContactFormButton } from "@/components/ContactFormButton";
import { NeuralNetwork } from "@/components/visual/NeuralNetwork";

export function Hero() {
  return <section className="hero" id="top"><div className="hero-grid" aria-hidden="true"/><NeuralNetwork/><div className="container hero-content"><div className="eyebrow"><span/> AI ENGINEERING <i/> MOSCOW</div><h1>Искусственный интеллект<br/>для <span>сложных систем</span></h1><p>Разрабатываем интеллектуальные системы для поиска, анализа и объединения знаний из документов, баз данных и корпоративных информационных систем.</p><div className="hero-actions"><a className="button" href="#technology">Наши технологии <ArrowDown size={17}/></a><ContactFormButton className="text-link" /></div><div className="tech-line"><span>LLM</span><i/><span>RAG</span><i/><span>BGE-M3</span><i/><span>VECTOR SEARCH</span><i/><span>MCP</span><i/><span>ONNX</span><i/><span>AI AGENTS</span></div></div><div className="hero-index">01 / INTELLIGENCE</div></section>;
}
