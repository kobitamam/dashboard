// Israel's VAT rate (18% since January 2025). Change it here if it changes again.
export const VAT_RATE = 0.18;

const cents = (value: number) => Math.round(value * 100) / 100;

export const addVat = (exVat: number) => cents(exVat * (1 + VAT_RATE));
export const removeVat = (inclVat: number) => cents(inclVat / (1 + VAT_RATE));
