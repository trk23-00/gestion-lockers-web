import Image from "next/image";
import styles from "./Logo.module.css";
export default function Logo() {
  return <div className={styles.mainContainer}>
    <Image src="/logo_2.png" alt="Logo de SGAP" width={146} height={146} className={styles.logo} priority />
    <span className={styles.tituloContainer}>SGAP</span>
  </div>;
}
