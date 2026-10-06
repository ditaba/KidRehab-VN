/** Public user fields – never includes passwordHash. */
export const publicUserSelect = {
  id: true,
  fullName: true,
  role: true,
} as const;
