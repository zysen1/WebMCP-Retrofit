// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

/** The shop order both scripted agents place. */
export const shopOrder = {
  q: 'cedar',
  category: 'drinkware',
  sku: 'cedar-mug',
  size: 'M',
  glaze: 'ash',
  qty: 2,
  fullName: 'Ada Lovelace',
  email: 'ada@analytical.example',
  phone: '206-555-0142',
  address1: '1 Analytical Engine Way',
  address2: 'Apt 4',
  city: 'Seattle',
  region: 'WA',
  postal: '98101',
  shipping: 'standard',
  cardName: 'Ada Lovelace',
  cardNumber: '4242424242424242',
  exp: '12/30',
  cvc: '123',
  notes: 'Leave at the side door',
} as const
