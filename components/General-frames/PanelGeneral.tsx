"use client";

import { useSyncExternalStore } from "react";
import { Inter, Quattrocento_Sans, Ramabhadra, Roboto } from "next/font/google";
import PublicHeader from "./PublicHeader";
import PublicFooter from "./PublicFooter";
import HomePanel from "./HomePanel";
import ServicesPanel from "./ServicesPanel";
import AboutPanel from "./AboutPanel";
import styles from "./PublicSite.module.css";

const inter = Inter({ subsets: ["latin"], variable: "--public-inter" });
const roboto = Roboto({ subsets: ["latin"], variable: "--public-roboto" });
const ramabhadra = Ramabhadra({ subsets: ["latin"], weight: "400", variable: "--public-ramabhadra" });
const quattrocento = Quattrocento_Sans({ subsets: ["latin"], weight: "400", variable: "--public-quattrocento" });

export type PublicSection = "inicio" | "servicios" | "nosotros";

function subscribe(onChange: () => void) {
  function handleNavigation() {
    onChange();
    document.getElementById("contenido")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  window.addEventListener("hashchange", handleNavigation);
  return () => window.removeEventListener("hashchange", handleNavigation);
}

function getSection(): PublicSection {
  const hash = window.location.hash.slice(1);
  return hash === "servicios" || hash === "nosotros" ? hash : "inicio";
}

export default function PanelGeneral() {
  const section = useSyncExternalStore(subscribe, getSection, () => "inicio" as const);

  return (
    <div className={`${styles.site} ${inter.variable} ${roboto.variable} ${ramabhadra.variable} ${quattrocento.variable}`}>
      <a className={styles.skipLink} href="#contenido" onClick={event => {
        event.preventDefault();
        const main = document.getElementById("contenido");
        main?.focus({ preventScroll: true });
        window.scrollTo({ top: 0, behavior: "instant" });
      }}>Saltar al contenido</a>
      <PublicHeader section={section} />
      <main id="contenido" className={styles.main} tabIndex={-1} aria-labelledby={section === "inicio" ? "home-title" : section === "servicios" ? "services-title" : "about-title"}>
        <div key={section} className={styles.panelTransition}>
          {section === "inicio" && <HomePanel />}
          {section === "servicios" && <ServicesPanel />}
          {section === "nosotros" && <AboutPanel />}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
