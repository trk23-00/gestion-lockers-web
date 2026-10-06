const URL_VERIFICACION = "https://www.google.com/recaptcha/api/siteverify";

export async function verificarCaptcha(token: string) {
  const secreto = process.env.RECAPTCHA_SECRET_KEY;

  if (!secreto) {
    throw new Error("La variable de entorno RECAPTCHA_SECRET_KEY no está definida");
  }

  const response = await fetch(URL_VERIFICACION, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret: secreto, response: token }),
  });

  const data = await response.json();

  return data.success === true;
}