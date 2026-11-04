const COMMON = ['admin123', 'password', 'motdepasse', 'azerty', 'qwerty', '123456789', 'groupendoye'];

/** Retourne la liste des critères non respectés (vide = mot de passe accepté). */
export function checkPasswordStrength(pw) {
  if (typeof pw !== 'string') return ['mot de passe invalide'];
  const issues = [];
  if (pw.length < 12) issues.push('12 caractères minimum');
  if (pw.length > 200) issues.push('200 caractères maximum');
  if (!/[a-z]/.test(pw)) issues.push('au moins une minuscule');
  if (!/[A-Z]/.test(pw)) issues.push('au moins une majuscule');
  if (!/[0-9]/.test(pw)) issues.push('au moins un chiffre');
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push('au moins un symbole');
  const low = pw.toLowerCase();
  if (COMMON.some((c) => low.includes(c))) issues.push('trop prévisible');
  return issues;
}
