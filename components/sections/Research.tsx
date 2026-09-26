import { Atom, Code2 } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { researchAreas } from "@/data/content";

export function Research() {
  return <section className="section research-section" id="research"><div className="container research-grid"><Reveal><span className="kicker">04 — ИССЛЕДОВАНИЯ И РАЗРАБОТКИ</span><h2>Не просто<br/>используем AI.<br/><span className="gradient-text">Исследуем его.</span></h2><p className="research-lead">Мы исследуем применение современных трансформерных моделей для интеграции гетерогенных информационных систем.</p><div className="research-equation"><span><Atom/> AI Research</span><b>×</b><span><Code2/> Software Engineering</span></div></Reveal><Reveal className="research-list">{researchAreas.map((area,i) => <div key={area}><span>{String(i+1).padStart(2,"0")}</span><p>{area}</p></div>)}</Reveal></div></section>;
}
