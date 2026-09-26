import { ArrowUpRight } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";
import { projects } from "@/data/content";

export function Projects() {
  return <section className="section projects-section" id="projects"><div className="container"><Reveal className="projects-head"><div><span className="kicker">05 — ПРОЕКТЫ</span><h2>Инженерные задачи.<br/><span className="muted">Измеримый результат.</span></h2></div><p>Опыт разработки решений для научно-образовательной среды и сложных информационных контуров.</p></Reveal><div className="projects-list">{projects.map((project,i) => <Reveal key={project.number} className="project-row" delay={i*.08}><div className="project-meta"><span>{project.number}</span><small>{project.type}</small></div><div><h3>{project.title}</h3><p>{project.text}</p><div className="tags">{project.tech.map((tech)=><span key={tech}>{tech}</span>)}</div></div><ArrowUpRight className="project-arrow"/></Reveal>)}</div></div></section>;
}
