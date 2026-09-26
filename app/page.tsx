import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CTA } from "@/components/sections/CTA";
import { Hero } from "@/components/sections/Hero";
import { PrivateAI } from "@/components/sections/PrivateAI";
import { Projects } from "@/components/sections/Projects";
import { Research } from "@/components/sections/Research";
import { Solutions } from "@/components/sections/Solutions";
import { Stats } from "@/components/sections/Stats";
import { Technology } from "@/components/sections/Technology";

export default function Home() {
  return <><Header /><main><Hero /><Solutions /><Technology /><Research /><Projects /><PrivateAI /><Stats /><CTA /></main><Footer /></>;
}
