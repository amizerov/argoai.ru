import { ArrowUpRight } from "lucide-react";
import { navigation } from "@/data/content";

export function Footer() {
  return <footer className="footer" id="about"><div className="container footer-grid"><div><a className="brand footer-brand" href="#top"><span className="brand-mark"><i/><i/><i/></span><span>ARGO</span><b>SOFT</b></a><p>AI Engineering &amp; Research</p><span className="domain">argoai.ru</span></div><nav aria-label="Навигация в подвале">{navigation.slice(0,4).map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav><div className="footer-contact"><span>СВЯЗАТЬСЯ</span><a href="mailto:andrey.mizerov@rcc.msu.ru">andrey.mizerov@rcc.msu.ru <ArrowUpRight size={16}/></a><a href="tel:+79253440222">+7 (925) 344-02-22</a><p>Ленинский горы, дом 1, корпус 4, здание НИВЦ</p><p>Реквизиты компании предоставляются по запросу.</p></div></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} ARGO SOFT</span><span>Москва · Россия</span></div></footer>;
}
