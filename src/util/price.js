// DB prices are strings like "$1,350", "~$395", "$2,678-2,996",
// "~$2,500-6,000", "from ~$165". Parse to a midpoint number for totals.
export function priceMidpoint(str) {
  if (!str) return null;
  const nums = [...str.matchAll(/\$?([\d,]+(?:\.\d+)?)/g)]
    .map((m) => parseFloat(m[1].replace(/,/g, '')))
    .filter((n) => !Number.isNaN(n) && n > 0);
  if (!nums.length) return null;
  return (Math.min(...nums) + Math.max(...nums)) / 2;
}

export function formatUSD(n) {
  if (n == null) return 'n/a';
  return '$' + Math.round(n).toLocaleString('en-US');
}
