/**
 * 跳跃步进规则：0 → 1 → 2 → 5 → 10 → 20，之后每次 +10
 */
const STEPS = [1, 2, 5, 10, 20];

function nextStepQuantity(current) {
  const n = Number(current) || 0;
  for (let i = 0; i < STEPS.length; i++) {
    if (n < STEPS[i]) return STEPS[i];
  }
  return n + 10;
}

function prevStepQuantity(current) {
  const n = Number(current) || 0;
  return Math.max(0, n - 1);
}

/**
 * 生成写操作幂等键（Idempotency-Key）
 */
function generateIdempotencyKey() {
  return 'wdm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

module.exports = {
  nextStepQuantity,
  prevStepQuantity,
  generateIdempotencyKey
};
