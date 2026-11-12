import { Link } from "react-router-dom";

export const PrivacyPolicy = () => (
  <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#e5e5e5", padding: "60px 20px" }}>
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link to="/" style={{ color: "#D4AF37", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 24 }}>
        &larr; Volver a BarberBook
      </Link>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Política de Privacidad</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 32 }}>Última actualización: junio 2026</p>

      <Section title="1. Información que recopilamos">
        <p>Cuando usas BarberBook, recopilamos la siguiente información:</p>
        <ul>
          <li><strong>Clientes:</strong> nombre, número de teléfono, historial de citas y puntos de fidelización.</li>
          <li><strong>Administradores y barberos:</strong> nombre, correo electrónico y datos de la barbería (nombre, dirección, logo).</li>
          <li><strong>Datos de uso:</strong> información técnica como tipo de dispositivo y navegador para mejorar el servicio.</li>
        </ul>
      </Section>

      <Section title="2. Cómo usamos tu información">
        <ul>
          <li>Gestionar y confirmar tus citas.</li>
          <li>Enviarte recordatorios y notificaciones por WhatsApp relacionadas con tus citas.</li>
          <li>Permitir la recuperación de tu cuenta mediante WhatsApp o correo electrónico.</li>
          <li>Acumular y gestionar puntos de fidelización.</li>
          <li>Proporcionar diagnósticos capilares con inteligencia artificial (si el servicio está disponible).</li>
          <li>Mejorar la plataforma y la experiencia del usuario.</li>
        </ul>
      </Section>

      <Section title="3. Mensajes de WhatsApp">
        <p>
          Al registrarte y agendar citas en BarberBook, aceptas recibir mensajes de WhatsApp relacionados con:
          confirmaciones de citas, recordatorios, reprogramaciones y cancelaciones.
          Puedes dejar de recibir estos mensajes contactando directamente a la barbería.
        </p>
      </Section>

      <Section title="4. Almacenamiento local (Cookies)">
        <p>
          BarberBook utiliza almacenamiento local del navegador (localStorage) para mantener tu sesión activa,
          guardar tus preferencias de tema visual y recordar tu último subdominio de acceso.
          No utilizamos cookies de rastreo ni compartimos esta información con terceros.
        </p>
      </Section>

      <Section title="5. Protección de datos">
        <p>
          Tus datos se almacenan en servidores seguros. Las contraseñas se encriptan con BCrypt y nunca se almacenan
          en texto plano. Las comunicaciones se realizan a través de HTTPS. El acceso a los datos está restringido
          al tenant (barbería) correspondiente mediante aislamiento multi-tenant.
        </p>
      </Section>

      <Section title="6. Diagnóstico capilar e inteligencia artificial (tratamiento de datos sensibles)">
        <p>
          El servicio de diagnóstico capilar automatizado requiere el procesamiento de imágenes o fotografías del rostro
          o cabello del usuario. De conformidad con la Ley 1581 de 2012, el usuario reconoce que no está obligado a
          suministrar estos datos por tratarse de información sensible (datos biométricos). Al cargar o capturar
          voluntariamente la fotografía en la plataforma, el usuario otorga su consentimiento explícito para que
          BarberBook procese dicha imagen utilizando herramientas de Inteligencia Artificial hospedadas en servidores
          de Google LLC (EE.UU.). Las fotografías serán utilizadas exclusivamente para generar el reporte de orientación
          estética, no se emplearán para fines de identificación masiva y serán eliminadas de forma definitiva de
          nuestros servidores en un plazo máximo de treinta (30) días calendario.
        </p>
      </Section>

      <Section title="7. Tratamiento de datos personales de menores de edad">
        <p>
          BarberBook podrá ser utilizada para prestar servicios a niños, niñas y adolescentes únicamente cuando el
          establecimiento (barbería o peluquería) haya obtenido la autorización previa, expresa e informada del padre,
          madre o representante legal, cuando esta sea exigida por la legislación colombiana.
        </p>
        <p>
          La barbería o peluquería será la responsable de verificar y conservar las autorizaciones necesarias para la
          captura y tratamiento de fotografías o demás datos personales de menores de edad. BarberBook actúa como
          proveedor de la plataforma tecnológica y no verifica la existencia de dichas autorizaciones.
        </p>
        <p>
          Las fotografías y demás datos personales de menores de edad serán tratados exclusivamente para la prestación
          del servicio solicitado, incluyendo la generación de recomendaciones de cortes mediante inteligencia artificial,
          la gestión de citas y demás funcionalidades de la plataforma. En ningún caso serán utilizados para finalidades
          distintas sin la autorización correspondiente.
        </p>
      </Section>

      <Section title="8. Compartir información y transferencia internacional de datos">
        <p>
          No vendemos, alquilamos ni compartimos tu información personal con terceros, excepto cuando sea estrictamente
          necesario para cumplir con obligaciones legales o para la correcta prestación del servicio contratado.
        </p>
        <p>
          Para la ejecución de las funciones de la aplicación, BarberBook realiza transferencia internacional de datos
          personales a Meta Platforms Inc. (proveedor de la API de WhatsApp Business para el envío de alertas y
          recordatorios) y a Google LLC (infraestructura de servidores en la nube e Inteligencia Artificial), ambos
          proveedores con centros de datos ubicados en los Estados Unidos de América. Al aceptar esta política, el
          usuario otorga su consentimiento previo, expreso e informado para dicha transferencia internacional de datos.
        </p>
      </Section>

      <Section title="9. Tus derechos">
        <p>Tienes derecho a:</p>
        <ul>
          <li>Acceder a tus datos personales.</li>
          <li>Solicitar la corrección de datos incorrectos.</li>
          <li>Solicitar la eliminación de tu cuenta y datos asociados.</li>
          <li>Revocar tu consentimiento para el envío de mensajes de WhatsApp.</li>
        </ul>
        <p>Para ejercer estos derechos, contacta al administrador de tu barbería o escríbenos a <strong>barberbook46@gmail.com</strong>.</p>
      </Section>

      <Section title="10. Cambios a esta política">
        <p>
          Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios significativos
          a través de la plataforma. El uso continuado del servicio implica la aceptación de los cambios.
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
