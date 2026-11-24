import { date, money, type Movement } from "./sgap-types";
import styles from "./UserDashboard.module.css";

const dayFormat = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default function DailyCollections({
  movements,
  scope,
}: {
  movements: Movement[];
  scope: string;
}) {
  const today = dayFormat.format(new Date());
  const collections = movements
    .filter(
      (m) =>
        m.tipo === "entrada" &&
        !m.anulado_en &&
        dayFormat.format(new Date(m.fecha)) === today,
    )
    .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha));
  const totalCents = collections.reduce(
    (sum, m) => sum + Math.round(Number(m.monto) * 100),
    0,
  );

  return (
    <>
      <p className={styles.muted}>
        {scope} · {today} · Hora de Bolivia
      </p>
      <dl className={styles.detailGrid}>
        <div>
          <dt>Entradas registradas</dt>
          <dd>{collections.length}</dd>
        </div>
        <div>
          <dt>Paquetes cobrados</dt>
          <dd>{new Set(collections.map((m) => m.id_paquete)).size}</dd>
        </div>
        <div>
          <dt>Total cobrado hoy</dt>
          <dd>{money(totalCents / 100)}</dd>
        </div>
      </dl>
      <p className={styles.muted}>
        Incluye anticipos y pagos pendientes cobrados hoy. Las devoluciones se
        consultan por separado.
      </p>
      {collections.length ? (
        <details>
          <summary>Ver cobros de hoy</summary>
          <div className={styles.tableWrap}>
            <table aria-label="Cobros realizados hoy">
              <thead>
                <tr>
                  <th>Movimiento</th>
                  <th>Paquete</th>
                  <th>Fecha</th>
                  <th>Medio</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {collections.map((m) => (
                  <tr key={m.id_movimiento}>
                    <td>MV-{m.id_movimiento}</td>
                    <td>{m.paquete?.codigo || `Paquete ${m.id_paquete}`}</td>
                    <td>{date(m.fecha)}</td>
                    <td>{m.medio}</td>
                    <td>{money(m.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={4} scope="row">
                    Total cobrado hoy
                  </th>
                  <td>{money(totalCents / 100)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </details>
      ) : (
        <p className={styles.muted}>No hay cobros registrados hoy.</p>
      )}
    </>
  );
}
