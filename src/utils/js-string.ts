export function jsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    // Remaining C0 controls plus U+2028/U+2029: ExtendScript (ES3) treats the
    // latter as line terminators, so raw occurrences break the string literal.
    .replace(/[\u0000-\u001f\u2028\u2029]/g, (ch) => {
      return '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
    });
}
