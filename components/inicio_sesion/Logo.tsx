import Image from "next/image";
import styles from "@/components/inicio_sesion/Logo.module.css";

const Logo = () => {
  return (
    <div className={styles.mainContainer}>
      <Image src="/Logo.svg" alt="logo" width={100} height={100} />
      <div className={styles.tituloContainer}>
        <span>COFRE</span>
        <span>EXPRESS</span>
      </div>
    </div>
  );
};

export default Logo;
