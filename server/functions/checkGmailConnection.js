import { getCurrentAppUserConnection, getProfile } from '../gmail.js';

export async function checkGmailConnection({ user }) {
  const conn = await getCurrentAppUserConnection(user.id);
  if (!conn?.access_token) return { connected: false };
  try {
    const profile = await getProfile(conn.access_token);
    return { connected: true, email: profile.emailAddress };
  } catch {
    return { connected: false };
  }
}
