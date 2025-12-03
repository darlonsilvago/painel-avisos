// backend/utils/phone.js
function normalizePhone(raw) {
  if (!raw) return null;

  // mantém só dígitos
  const digits = String(raw).replace(/\D/g, '');

  if (!digits) return null;

  // se já começa com 55, mantemos
  if (digits.startsWith('55')) {
    return digits;
  }

  // senão, coloca 55 na frente
  return '55' + digits;
}

module.exports = { normalizePhone };
