import { Reveal } from "@/components/ui/Reveal";
import { stats } from "@/data/content";

export function Stats() {
  return <section className="stats-section"><div className="container stats-grid"><Reveal className="stats-title"><span className="kicker">07 — ДАННЫЕ</span><p>Проверяемый масштаб<br/>прикладных задач</p></Reveal>{stats.map((stat,i)=><Reveal key={stat.value} className="stat" delay={i*.1}><strong>{stat.value}</strong><span>{stat.label}</span></Reveal>)}</div></section>;
}
