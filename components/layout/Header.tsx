"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { navigation } from "@/data/content";
import { ContactFormButton } from "@/components/ContactFormButton";

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 24); onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  return <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
    <a className="brand" href="#top" aria-label="ARGO SOFT — наверх"><span className="brand-mark"><i /><i /><i /></span><span>ARGO</span><b>SOFT</b></a>
    <nav className={`desktop-nav ${open ? "is-open" : ""}`} aria-label="Основная навигация">{navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setOpen(false)}>{item.label}</a>)}<ContactFormButton className="button button-small" onOpen={() => setOpen(false)} /></nav>
    <button className="menu-button" onClick={() => setOpen(!open)} aria-label={open ? "Закрыть меню" : "Открыть меню"} aria-expanded={open}>{open ? <X /> : <Menu />}</button>
  </header>;
}
