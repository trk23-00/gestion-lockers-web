# SGAP · Cofre Express

Prototipo de gestión de paquetes con Next.js, PostgreSQL y Prisma. Incluye paneles de administrador, recepcionista, almacenero y cliente, con módulos y permisos por perfil.

Consulte **[DESARROLLO.md](DESARROLLO.md)** para instalar el proyecto desde una copia local del repositorio, configurar Docker y la DB, utilizar las cuentas iniciales y ejecutar las pruebas.

Primera instalación, dentro de esta carpeta:

```powershell
Copy-Item .env.example .env
npm ci
docker compose up -d --wait
npm run setup
npm run dev
```

En otra terminal ejecute `npm run jobs` para generar los recargos periódicos. Si ya utiliza una DB de Docker, conserve su configuración y siga la sección correspondiente de la guía antes de iniciar otro contenedor.

Interfaz basada en el [diseño de Figma](https://www.figma.com/design/kRKhxYJzGEv3tlGXJFn5jt/SisLckers?node-id=263-805), con información real de la DB. Los datos y las cuentas de ejemplo son exclusivamente para desarrollo local.
