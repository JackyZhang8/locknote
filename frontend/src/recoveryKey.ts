// 恢复密钥的归一化与校验，规则与 Go 侧 internal/crypto 保持一致：
// 去掉空白与分隔符、转大写，并把易混淆字符按 Crockford 规则映射（I/L→1，O→0）。
// 恢复密钥固定 16 位，字符集为 Crockford Base32（不含 I、L、O、U）。

const RECOVERY_KEY_LENGTH = 16;
const RECOVERY_KEY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function normalizeRecoveryKey(input: string): string {
  const stripped = input.replace(/[\s_-]/g, '').toUpperCase();
  return stripped.replace(/[IL]/g, '1').replace(/O/g, '0');
}

export function isValidRecoveryKey(input: string): boolean {
  const normalized = normalizeRecoveryKey(input);
  if (normalized.length !== RECOVERY_KEY_LENGTH) {
    return false;
  }
  for (const char of normalized) {
    if (!RECOVERY_KEY_ALPHABET.includes(char)) {
      return false;
    }
  }
  return true;
}
