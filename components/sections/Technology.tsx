import { Reveal } from "@/components/ui/Reveal";
import { DataFlow } from "@/components/visual/DataFlow";

export function Technology() {
  return <section className="section technology-section" id="technology"><div className="container"><Reveal className="section-heading"><span className="kicker">03 — ТЕХНОЛОГИЧЕСКАЯ ПЛАТФОРМА</span><h2>Интеллектуальный слой<br/><span className="muted">между системами</span></h2><p>Единая архитектура связывает разрозненные источники данных с AI-инструментами, не заменяя существующую инфраструктуру.</p></Reveal><Reveal><DataFlow/></Reveal></div></section>;
}
