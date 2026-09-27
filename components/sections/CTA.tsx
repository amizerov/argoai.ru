import { ContactFormButton } from "@/components/ContactFormButton";
import { Reveal } from "@/components/ui/Reveal";

export function CTA() {
  return <section className="cta-section" id="contacts"><div className="cta-orb"/><div className="container"><Reveal><span className="kicker">НАЧНЁМ С ЗАДАЧИ</span><h2>Есть данные. Есть системы.<br/><span className="gradient-text">Добавим интеллект.</span></h2><div className="cta-bottom"><p>Обсудим, где AI действительно может дать эффект в вашей информационной инфраструктуре.</p><ContactFormButton className="button button-large" /></div></Reveal></div></section>;
}
