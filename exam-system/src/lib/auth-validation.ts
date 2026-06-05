export function normalizeEmail(email: string | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function getEmailValidationError(email: string | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return "メールアドレスを入力してください。";
  if (normalized.length > 254) return "メールアドレスは254文字以内で入力してください。";
  if (/\s/.test(normalized)) return "メールアドレスに空白は使えません。";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "メールアドレスの形式を確認してください。";
  }
  return "";
}

export function getPasswordValidationError(password: string | undefined, studentId: string) {
  if (!password) return "パスワードを入力してください。";
  if (password.length < 8) return "パスワードは8文字以上で入力してください。";
  if (!/^[!-~]+$/.test(password)) return "パスワードは半角英数字・記号で入力してください。";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "パスワードは半角英字と数字を両方含めてください。";
  }
  if (/^(.)\1+$/.test(password)) return "同じ文字だけのパスワードは使えません。";
  if (studentId && password === studentId) return "生徒IDと同じパスワードは使えません。";
  return "";
}
