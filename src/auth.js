// Bearer-token check with two deliberate details:
//  1. Both sides are trimmed. A secret pasted into a dashboard with a trailing
//     space is a classic silent failure; trimming makes it harmless.
//  2. An empty or missing secret NEVER authorises anything. Without this, a
//     Worker that lost its secret binding would accept a request that sends
//     no credentials at all.
export function isAuthorized(authorizationHeader, secret) {
  const expectedSecret = String(secret ?? '').trim();
  if (expectedSecret === '') return false;

  const header = String(authorizationHeader ?? '').trim();
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return false;

  return constantTimeEqual(header.slice(prefix.length).trim(), expectedSecret);
}

// Compares every byte even after a mismatch, so response time does not leak
// how much of a guess was correct.
function constantTimeEqual(a, b) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    difference |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return difference === 0;
}
