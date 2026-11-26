// Stay informed signups: takes the homepage form post and adds the person to an
// iContact list (API v2.2). Credentials live in Worker secrets, never in the site.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function validate(body) {
  const signup = {
    firstName: clean(body?.firstName, 60),
    lastName: clean(body?.lastName, 60),
    email: clean(body?.email, 254).toLowerCase(),
    phone: clean(body?.phone, 30),
    smsConsent: body?.smsConsent === 'yes' || body?.smsConsent === true,
  };
  if (!signup.firstName) return {error: 'first_name'};
  if (!EMAIL.test(signup.email)) return {error: 'email'};
  if (signup.smsConsent && !signup.phone) return {error: 'sms_phone'};
  if (signup.phone) {
    const digits = signup.phone.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15 || /[^\d\s().+-]/.test(signup.phone)) return {error: 'phone'};
  }
  return {signup};
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : '';
}

function reply(status, body, origin) {
  const headers = {'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin'};
  if (origin) Object.assign(headers, {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400'});
  return new Response(status === 204 ? null : JSON.stringify(body), {status, headers});
}

async function icontact(env, path, payload, fetchImpl) {
  const base = `https://app.icontact.com/icp/a/${env.ICONTACT_ACCOUNT_ID}/c/${env.ICONTACT_FOLDER_ID}`;
  const response = await fetchImpl(`${base}/${path}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'API-Version': '2.2',
      'API-AppId': env.ICONTACT_APP_ID,
      'API-Username': env.ICONTACT_USERNAME,
      'API-Password': env.ICONTACT_PASSWORD,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`iContact ${path} ${response.status}: ${JSON.stringify(data.errors || data).slice(0, 300)}`);
  return data;
}

export async function handle(request, env, fetchImpl = fetch) {
  const origin = allowedOrigin(request, env);
  if (request.method === 'OPTIONS') return reply(origin ? 204 : 403, {}, origin);
  if (request.method !== 'POST') return reply(405, {ok: false, error: 'method'}, origin);
  if (!origin) return reply(403, {ok: false, error: 'origin'}, '');

  let body;
  try { body = await request.json(); } catch { return reply(400, {ok: false, error: 'json'}, origin); }
  // Bots fill every field, including the one people can't see. Pretend it worked.
  if (clean(body?.website, 200)) return reply(200, {ok: true}, origin);

  const {signup, error} = validate(body);
  if (error) return reply(400, {ok: false, error}, origin);

  try {
    const contact = {email: signup.email, firstName: signup.firstName, lastName: signup.lastName};
    if (signup.phone) contact.phone = signup.phone;
    const added = await icontact(env, 'contacts', [contact], fetchImpl);
    const contactId = added.contacts?.[0]?.contactId;
    if (!contactId) throw new Error('iContact returned no contactId: ' + JSON.stringify(added).slice(0, 300));
    // Text-message consent is kept as its own list, so the subscription date records when it was given.
    const lists = [env.ICONTACT_LIST_ID, signup.smsConsent && env.ICONTACT_SMS_LIST_ID].filter(Boolean);
    await icontact(env, 'subscriptions', lists.map(listId => ({contactId, listId, status: 'normal'})), fetchImpl);
    return reply(200, {ok: true}, origin);
  } catch (failure) {
    console.error(failure);
    return reply(502, {ok: false, error: 'upstream'}, origin);
  }
}

export default {fetch: (request, env) => handle(request, env)};
