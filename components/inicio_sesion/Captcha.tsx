"use client";

import ReCAPTCHA from "react-google-recaptcha";
import styles from "@/components/inicio_sesion/Captcha.module.css";

type Props = {
  onChange: (token: string | null) => void;
  refreshKey: number;
};

const Captcha = ({ onChange, refreshKey }: Props) => {
  return (
    <div className={styles.captcha}>
      <ReCAPTCHA
        key={refreshKey}
        sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? ""}
        onChange={onChange}
      />
    </div>
  );
};

export default Captcha;