/**
 * Integración con Active Directory de Collahuasi (pendiente).
 *
 * Contexto:
 *   Collahuasi habilitará un SSO (probablemente Azure AD vía SAML u OIDC) que
 *   redirigirá a esta aplicación después de autenticar al usuario en su IdP.
 *   Cuando eso ocurra, NO vamos a usar el formulario de login de
 *   /login — el flujo pasará por un endpoint de callback que recibirá el
 *   token/assertion del IdP, lo validará, y creará una sesión local.
 *
 * Flujo esperado cuando se active:
 *
 *   1. Usuario hace click en "Iniciar sesión con Collahuasi" (o entra directo
 *      a un enlace protegido) → redirigir a la URL de login del IdP.
 *   2. IdP autentica y redirige a /api/auth/sso/callback con un código o
 *      assertion firmada.
 *   3. Ese handler:
 *        a. Valida la firma del IdP (usar librería oficial: @azure/msal-node
 *           para OIDC, o samlify / @node-saml/node-saml para SAML).
 *        b. Extrae el email del claim (`preferred_username` / `email` /
 *           `NameID` según sea OIDC o SAML).
 *        c. Llama a isCollahuasiEmail(email). Si es false → 403.
 *        d. Hace upsert en la tabla `usuarios`:
 *             - si no existe: INSERT con auth_method='sso', password_hash=NULL
 *               y rol por defecto 'operador' (el admin debe promover manual).
 *             - si existe: UPDATE ultimo_login, nombre si cambió.
 *        e. Llama createSession(user) → setea cookie → redirect('/').
 *
 *   4. El botón "Cerrar sesión" sigue funcionando igual (deleteSession +
 *      opcionalmente redirigir al logout endpoint del IdP para SSO global).
 *
 * Notas de seguridad:
 *   - Nunca confiar en un header/claim sin validar firma del IdP.
 *   - Guardar el secret/cert del IdP en variables de entorno
 *     (AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET).
 *   - El dominio permitido se controla acá, no en el IdP, para defensa en
 *     profundidad.
 */

const ALLOWED_DOMAIN = "collahuasi.cl";

/**
 * Devuelve true si el email pertenece al dominio corporativo de Collahuasi.
 * Comparación case-insensitive y tolerante a espacios al inicio/final.
 */
export function isCollahuasiEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  // Validación mínima de formato antes de chequear el dominio.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return false;
  return normalized.endsWith(`@${ALLOWED_DOMAIN}`);
}

// TODO(AD): reemplazar por el handler real cuando Collahuasi entregue
// los datos del IdP (tenant, client id, cert público, etc.).
//
// export async function handleSsoCallback(request: Request) {
//   // 1. Validar assertion/token del IdP
//   // 2. Extraer email
//   // 3. if (!isCollahuasiEmail(email)) return 403
//   // 4. Upsert usuarios (auth_method='sso')
//   // 5. createSession(user) → redirect('/')
// }
