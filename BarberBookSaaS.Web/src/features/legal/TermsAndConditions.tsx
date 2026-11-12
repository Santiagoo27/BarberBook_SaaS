import { Link } from "react-router-dom";

export const TermsAndConditions = () => (
  <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "60px 20px" }}>
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link to="/" style={{ color: "#D4AF37", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 24 }}>
        &larr; Volver a BarberBook
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Términos y Condiciones</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>Última actualización: junio 2026</p>

      <Section title="1. Aceptación de los términos">
        <p>
          Al acceder y utilizar BarberBook, aceptas estos términos y condiciones en su totalidad.
          Si no estás de acuerdo con alguna parte, no debes utilizar la plataforma.
        </p>
      </Section>

      <Section title="2. Descripción del servicio">
        <p>
          BarberBook es una plataforma de agendamiento de citas para barberías. Permite a las barberías
          gestionar sus citas, barberos, servicios y clientes. Los clientes pueden agendar, reprogramar
          y cancelar citas a través de la plataforma.
        </p>
      </Section>

      <Section title="3. Cuentas de usuario">
        <ul>
          <li><strong>Barberías (Admin):</strong> se registran con correo electrónico y contraseña. Son responsables de la información de su negocio y de los barberos que registran.</li>
          <li><strong>Barberos:</strong> reciben acceso mediante credenciales temporales proporcionadas por el administrador de la barbería.</li>
          <li><strong>Clientes:</strong> se registran con número de teléfono y contraseña. Son responsables de mantener la seguridad de sus credenciales.</li>
        </ul>
      </Section>

      <Section title="4. Uso aceptable">
        <p>Te comprometes a:</p>
        <ul>
          <li>Proporcionar información veraz y actualizada.</li>
          <li>No crear cuentas falsas ni suplantar identidades.</li>
          <li>No intentar acceder a datos de otros tenants (barberías).</li>
          <li>No utilizar la plataforma para fines ilegales o no autorizados.</li>
          <li>No abusar del sistema de citas (ej: agendar citas sin intención de asistir).</li>
        </ul>
      </Section>

      <Section title="5. Citas y cancelaciones">
        <ul>
          <li>Las citas deben agendarse con al menos 3 horas de antelación.</li>
          <li>Las cancelaciones solo son posibles mientras la cita esté en estado pendiente.</li>
          <li>La barbería se reserva el derecho de cancelar o reprogramar citas por motivos operativos.</li>
        </ul>
      </Section>

      <Section title="6. Planes y funcionalidades">
        <p>
          BarberBook ofrece diferentes planes con funcionalidades variables. Las características disponibles
          dependen del plan contratado por la barbería.
        </p>
        <p>
          <strong>Modificación de Planes y Tarifas:</strong> BarberBook se reserva el derecho de modificar
          los planes, características y tarifas del servicio. Cualquier cambio en las condiciones económicas
          será notificado a las barberías registradas con una antelación mínima de treinta (30) días calendario,
          mediante correo electrónico enviado a la dirección del administrador o mediante un aviso destacado
          dentro de la plataforma. Las barberías que tengan un plan mensual vigente mantendrán su tarifa actual
          hasta la finalización de su periodo de facturación en curso. Las barberías que hayan adquirido planes
          anuales o prepagados mantendrán las condiciones de precio contratadas de manera inalterable hasta la
          fecha de vencimiento de dicho plan. El uso continuado de la aplicación tras la entrada en vigencia de
          las nuevas tarifas constituirá la aceptación de las mismas.
        </p>
      </Section>

      <Section title="7. Propiedad intelectual">
        <p>
          Todo el contenido de BarberBook (diseño, código, logos, textos) es propiedad de sus creadores.
          El contenido subido por los usuarios (logos de barberías, fotos) sigue siendo propiedad de
          quien lo suba, otorgando a BarberBook una licencia de uso para mostrar dicho contenido en la plataforma.
        </p>
      </Section>

      <Section title="8. Limitación de responsabilidad y disponibilidad">
        <p>
          BarberBook es una herramienta tecnológica de agendamiento y soporte que se provee en el estado en que se
          encuentra (&ldquo;tal cual&rdquo;). Si bien desplegamos nuestros mejores esfuerzos técnicos para mantener
          la plataforma en óptimas condiciones, no garantizamos una disponibilidad ininterrumpida del 100% debido a
          factores externos como fallas en las redes de telecomunicaciones, caídas de servidores de terceros (Google,
          Meta) o mantenimiento técnico obligatorio.
        </p>
        <p>
          BarberBook actúa únicamente como un intermediario tecnológico entre la barbería y el cliente final; por lo
          tanto, no se hace responsable por: (i) la inasistencia, cancelación o incumplimiento de las citas por
          cualquiera de las partes, (ii) la calidad del servicio de peluquería o estética prestado en el establecimiento,
          (iii) errores en la introducción de datos o radicados por parte de los usuarios, o (iv) pérdidas económicas o
          de citas derivadas de fallas temporales en la sincronización de la plataforma. La responsabilidad total de
          BarberBook frente a las barberías contratantes por cualquier falla comprobada imputable directamente al
          software estará limitada, como máximo, al valor equivalente a una (1) mensualidad del plan contratado por el
          usuario afectado.
        </p>
      </Section>

      <Section title="9. Diagnóstico IA">
        <p>
          El servicio de diagnóstico capilar con inteligencia artificial es una herramienta de orientación.
          Los resultados son sugerencias generadas automáticamente y no constituyen asesoría profesional
          médica o dermatológica. La barbería y el cliente son responsables de las decisiones tomadas
          basándose en estos resultados.
        </p>
      </Section>

      <Section title="10. Uso respecto de menores de edad">
        <p>
          Cuando los servicios de BarberBook sean utilizados respecto de menores de edad, la barbería o peluquería
          declara y garantiza que ha obtenido las autorizaciones exigidas por la legislación aplicable para el
          tratamiento de sus datos personales e imágenes. BarberBook no será responsable por la ausencia de dichas
          autorizaciones, siendo esta una obligación exclusiva del establecimiento que presta el servicio.
        </p>
      </Section>

      <Section title="11. Terminación">
        <p>
          Nos reservamos el derecho de suspender o cancelar cuentas que violen estos términos.
          Los administradores de barberías pueden solicitar la eliminación de su cuenta y datos
          contactando al soporte.
        </p>
      </Section>

      <Section title="12. Cambios a los términos">
        <p>
          Podemos modificar estos términos en cualquier momento. Los cambios serán efectivos al publicarse
          en esta página. El uso continuado de la plataforma después de los cambios implica su aceptación.
        </p>
      </Section>

      <Section title="13. Contacto">
        <p>
          Para consultas sobre estos términos, escríbenos a <strong>barberbook46@gmail.com</strong>.
        </p>
      </Section>

      <Section title="14. Ley aplicable y jurisdicción competente">
        <p>
          Estos Términos y Condiciones se rigen, interpretan y ejecutan en su totalidad de conformidad con las leyes
          vigentes de la República de Colombia, en especial por la Ley 1480 de 2011 (Estatuto del Consumidor), la Ley
          1581 de 2012 (Habeas Data) y sus decretos reglamentarios.
        </p>
        <p>
          Cualquier diferencia, controversia o reclamación surgida entre las partes con ocasión de la existencia,
          interpretación, ejecución o terminación de este acuerdo, buscará ser resuelta inicialmente de mutuo acuerdo
          mediante un arreglo amistoso directo en un plazo máximo de quince (15) días hábiles; de no lograrse una
          conciliación, las controversias surgidas con las Barberías o Administradores (relación comercial) se someterán
          a la jurisdicción exclusiva de los jueces competentes de la ciudad de Pasto, Nariño, Colombia, mientras que las
          controversias suscitadas con los Usuarios o Clientes Finales (relación de consumo) se dirimirán ante los jueces
          o autoridades competentes según las reglas generales de competencia territorial vigentes en la legislación
          colombiana, garantizando así un equilibrio legal y la protección de los derechos de todas las partes involucradas.
        </p>
      </Section>
    </div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 28 }}>
    <h2 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{title}</h2>
    <div style={{ fontSize: 14, lineHeight: 1.7, color: "#ccc" }}>{children}</div>
  </div>
);
