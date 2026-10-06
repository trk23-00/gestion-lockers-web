import styles from "@/components/inicio_sesion/AuthButton.module.css";

type Props = {
  text: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
};

const AuthButton = ({ text, onClick, type = "button", disabled = false }: Props) => {
  return (
    <button className={styles.authButton} type={type} onClick={onClick} disabled={disabled}>
      {text}
    </button>
  );
};

export default AuthButton;
