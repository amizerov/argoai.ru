import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { solutions } from "@/data/content";
import { OneCServices } from "./OneCServices";

export function Solutions() {
  return <section className="section solutions-section" id="solutions"><div className="container"><Reveal className="section-intro"><div><span className="kicker">02 — ЧТО МЫ ДЕЛАЕМ</span><h2>Превращаем данные<br/>в <span className="gradient-text">знания</span></h2></div><p>Современные организации используют десятки информационных систем. Мы создаём AI-слой, который помогает находить, сопоставлять и использовать информацию независимо от того, где она хранится.</p></Reveal><div className="solutions-grid">{solutions.map(({icon: Icon, ...item}, i) => <Reveal key={item.title} className={`solution-card accent-${item.accent}`} delay={i*.05}><div className="card-top"><span>{item.index}</span><Icon size={25} strokeWidth={1.5}/></div><h3>{item.title}</h3><p>{item.text}</p><ArrowUpRight className="card-arrow" size={18}/></Reveal>)}</div><OneCServices /></div></section>;
}
