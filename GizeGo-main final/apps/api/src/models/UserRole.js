export const USER_ROLES = [
  "passenger",
  "driver",
  "admin",
  "ticket_vendor",
];

export function isUserRole(value) {
  return typeof value === "string" && USER_ROLES.includes(value);
}
