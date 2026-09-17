export const STUDENT_AUTH_EMAIL_DOMAIN = "smartqa.internal";

export function studentSyntheticEmail(studentNumber: string): string {
  return `${studentNumber.trim()}@${STUDENT_AUTH_EMAIL_DOMAIN}`;
}
