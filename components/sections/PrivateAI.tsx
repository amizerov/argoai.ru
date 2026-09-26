import { Check, LockKeyhole, Server } from "lucide-react";
import { Reveal } from "@/components/ui/Reveal";

const benefits = ["Private infrastructure", "Local LLM", "Local embeddings", "Access control", "Audit", "No external AI API required"];

export function PrivateAI() {
  return <section className="section private-section"><div className="private-glow"/><div className="container private-grid"><Reveal><span className="kicker">06 — PRIVATE AI</span><h2>Ваши данные<br/><span className="gradient-text">остаются у вас</span></h2><p>ARGO SOFT проектирует AI-решения, которые могут работать внутри инфраструктуры организации.</p><div className="benefits">{benefits.map((item)=><span key={item}><Check size={15}/>{item}</span>)}</div></Reveal><Reveal className="server-visual"><div className="server-orbit orbit-one"/><div className="server-orbit orbit-two"/><div className="server-stack">{["AI NODE / 03","VECTOR DB / 02","LLM CORE / 01"].map((item,i)=><div key={item} style={{"--level":i} as React.CSSProperties}><Server size={20}/><span>{item}</span><i/><i/><i/></div>)}</div><div className="lock-badge"><LockKeyhole size={20}/><span>PRIVATE<br/><b>SECURE</b></span></div><span className="visual-caption">ON-PREMISE AI INFRASTRUCTURE</span></Reveal></div></section>;
}
