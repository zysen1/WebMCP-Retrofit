// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.

import type { FlowAction } from '../types.ts'
import { shopOrder } from './goal.ts'
import { control, formOpen } from './html.ts'

export interface ApiInput {
  query: URLSearchParams
  body: Record<string, unknown>
  state: { seq: number }
}

export interface ApiResult {
  status: number
  body: unknown
}

export interface SiteDefinition {
  id: string
  title: string
  kicker: string
  accent: string
  intro: string
  initialView: string
  nav: { id: string; label: string }[]
  views: { id: string; html: string }[]
  handlers: Record<string, (input: ApiInput) => ApiResult>
  flow: FlowAction[]
}

function bad(message: string): ApiResult {
  return { status: 422, body: { error: message } }
}

const PRODUCTS = [
  { sku: 'cedar-mug', name: 'Cedar Camp Mug', category: 'drinkware', price: 28 },
  { sku: 'linen-towel', name: 'Linen Towel', category: 'textiles', price: 18 },
  { sku: 'ash-bowl', name: 'Ash Serving Bowl', category: 'drinkware', price: 42 },
  { sku: 'wool-cap', name: 'Wool Watch Cap', category: 'textiles', price: 36 },
]

const shop: SiteDefinition = {
  id: 'shop',
  title: 'Northwind Nook',
  kicker: 'Demo shop',
  accent: '#0e6b52',
  intro: 'A local catalog with no account and a mock card. Both agents place the same mug order.',
  initialView: 'catalog',
  nav: [
    { id: 'catalog', label: 'Catalog' },
    { id: 'cart', label: 'Cart' },
    { id: 'checkout', label: 'Checkout' },
  ],
  views: [
    {
      id: 'catalog',
      html: `
        <h2>Catalog</h2>
        ${formOpen({ id: 'search-catalog', title: 'Search catalog', endpoint: '/api/products', method: 'GET', transport: 'fetch', result: 'search-results' })}
          ${control({ formId: 'search-catalog', name: 'q', label: 'Search', required: true })}
          ${control({
            formId: 'search-catalog',
            name: 'category',
            label: 'Category',
            required: true,
            options: [
              { value: 'all', label: 'All' },
              { value: 'drinkware', label: 'Drinkware' },
              { value: 'textiles', label: 'Textiles' },
            ],
          })}
          <button type="submit">Search</button>
        </form>
        <div id="search-results" class="results"></div>
      `,
    },
    {
      id: 'product',
      html: `
        <h2 id="product-heading">Product</h2>
        ${formOpen({ id: 'add-to-cart', title: 'Add to cart', endpoint: '/api/cart', method: 'POST', transport: 'fetch', result: 'cart-summary' })}
          ${control({
            formId: 'add-to-cart',
            name: 'sku',
            label: 'Product',
            required: true,
            options: PRODUCTS.map((product) => ({ value: product.sku, label: product.name })),
          })}
          ${control({
            formId: 'add-to-cart',
            name: 'size',
            label: 'Size',
            required: true,
            options: [
              { value: 'M', label: 'M' },
              { value: 'L', label: 'L' },
            ],
          })}
          ${control({
            formId: 'add-to-cart',
            name: 'glaze',
            label: 'Glaze',
            required: true,
            options: [
              { value: 'ash', label: 'Ash' },
              { value: 'sand', label: 'Sand' },
            ],
          })}
          ${control({ formId: 'add-to-cart', name: 'qty', label: 'Quantity', type: 'number', required: true, min: 1, max: 9 })}
          <button type="submit">Add to cart</button>
        </form>
      `,
    },
    {
      id: 'cart',
      html: `
        <h2>Cart</h2>
        <div id="cart-summary" class="results"></div>
        <p><a href="#checkout" data-nav="checkout">Continue to checkout</a></p>
      `,
    },
    {
      id: 'checkout',
      html: `
        <h2>Checkout</h2>
        <p id="checkout-line"></p>
        ${formOpen({ id: 'place-order', title: 'Place order', endpoint: '/api/checkout', method: 'POST', transport: 'xhr', result: 'outcome' })}
          ${control({ formId: 'place-order', name: 'sku', label: 'Product sku', hidden: true, required: true })}
          ${control({ formId: 'place-order', name: 'size', label: 'Line size', hidden: true, required: true })}
          ${control({ formId: 'place-order', name: 'glaze', label: 'Line glaze', hidden: true, required: true })}
          ${control({ formId: 'place-order', name: 'qty', label: 'Line quantity', hidden: true, required: true, valueType: 'number' })}
          ${control({ formId: 'place-order', name: 'fullName', label: 'Full name', required: true })}
          ${control({ formId: 'place-order', name: 'email', label: 'Email', type: 'email', required: true })}
          ${control({ formId: 'place-order', name: 'phone', label: 'Phone', type: 'tel', required: true })}
          ${control({ formId: 'place-order', name: 'address1', label: 'Address', required: true })}
          ${control({ formId: 'place-order', name: 'address2', label: 'Address line 2' })}
          ${control({ formId: 'place-order', name: 'city', label: 'City', required: true })}
          ${control({
            formId: 'place-order',
            name: 'region',
            label: 'Region',
            required: true,
            options: [
              { value: 'CA', label: 'California' },
              { value: 'NY', label: 'New York' },
              { value: 'WA', label: 'Washington' },
            ],
          })}
          ${control({ formId: 'place-order', name: 'postal', label: 'Postal code', required: true })}
          ${control({
            formId: 'place-order',
            name: 'shipping',
            label: 'Shipping',
            required: true,
            options: [
              { value: 'standard', label: 'Standard' },
              { value: 'express', label: 'Express' },
            ],
          })}
          ${control({ formId: 'place-order', name: 'cardName', label: 'Name on mock card', required: true })}
          ${control({ formId: 'place-order', name: 'cardNumber', label: 'Mock card number', required: true })}
          ${control({ formId: 'place-order', name: 'exp', label: 'Expiry', required: true })}
          ${control({ formId: 'place-order', name: 'cvc', label: 'CVC', required: true })}
          ${control({ formId: 'place-order', name: 'notes', label: 'Notes', type: 'textarea' })}
          ${control({ formId: 'place-order', name: 'terms', label: 'I agree to the mock terms', type: 'checkbox', required: true })}
          <button type="submit">Place order</button>
        </form>
      `,
    },
    {
      id: 'done',
      html: `<h2>Order confirmed</h2><div id="outcome"></div>`,
    },
  ],
  handlers: {
    'GET /api/products': ({ query }) => {
      const q = (query.get('q') ?? '').trim().toLowerCase()
      const category = query.get('category') ?? 'all'
      const products = PRODUCTS.filter((product) => {
        const matchesQuery = q === '' || product.name.toLowerCase().includes(q) || product.sku.includes(q)
        const matchesCategory = category === 'all' || product.category === category
        return matchesQuery && matchesCategory
      })
      return { status: 200, body: { products } }
    },
    'POST /api/cart': ({ body }) => {
      const product = PRODUCTS.find((item) => item.sku === body.sku)
      if (!product) return bad('Unknown sku')
      if (body.size !== 'M' && body.size !== 'L') return bad('Unknown size')
      if (body.glaze !== 'ash' && body.glaze !== 'sand') return bad('Unknown glaze')
      const qty = Number(body.qty)
      if (!Number.isInteger(qty) || qty < 1 || qty > 9) return bad('Quantity must be from 1 to 9')
      return {
        status: 201,
        body: {
          line: {
            sku: product.sku,
            name: product.name,
            size: body.size,
            glaze: body.glaze,
            qty,
            unitPrice: product.price,
            lineTotal: product.price * qty,
          },
        },
      }
    },
    'POST /api/checkout': ({ body, state }) => {
      const product = PRODUCTS.find((item) => item.sku === body.sku)
      if (!product) return bad('Unknown sku')
      const qty = Number(body.qty)
      if (!Number.isInteger(qty) || qty < 1 || qty > 9) return bad('Quantity must be from 1 to 9')
      if (typeof body.fullName !== 'string' || body.fullName.trim() === '') return bad('Name is required')
      if (typeof body.email !== 'string' || !body.email.includes('@')) return bad('Email is required')
      if (body.shipping !== 'standard' && body.shipping !== 'express') return bad('Unknown shipping')
      if (typeof body.cardNumber !== 'string' || body.cardNumber.replaceAll(' ', '').length < 12) {
        return bad('Mock card number is too short')
      }
      if (body.terms !== true) return bad('Terms must be accepted')
      const shippingCost = body.shipping === 'express' ? 12 : 4
      const id = `NW-${1000 + state.seq}`
      state.seq += 1
      return {
        status: 201,
        body: {
          order: {
            id,
            sku: product.sku,
            qty,
            email: body.email,
            shipping: body.shipping,
            total: product.price * qty + shippingCost,
          },
        },
      }
    },
  },
  flow: [
    { type: 'fill', selector: '#search-catalog-q', value: shopOrder.q },
    { type: 'select', selector: '#search-catalog-category', value: shopOrder.category },
    { type: 'click', selector: '#search-catalog button[type=submit]' },
    { type: 'click', selector: '[data-open-product="cedar-mug"]' },
    { type: 'select', selector: '#add-to-cart-size', value: shopOrder.size },
    { type: 'select', selector: '#add-to-cart-glaze', value: shopOrder.glaze },
    { type: 'fill', selector: '#add-to-cart-qty', value: String(shopOrder.qty) },
    { type: 'click', selector: '#add-to-cart button[type=submit]' },
    { type: 'click', selector: 'nav [data-nav=cart]' },
    { type: 'click', selector: '[data-view=cart] [data-nav=checkout]' },
    { type: 'fill', selector: '#place-order-fullName', value: shopOrder.fullName },
    { type: 'fill', selector: '#place-order-email', value: shopOrder.email },
    { type: 'fill', selector: '#place-order-phone', value: shopOrder.phone },
    { type: 'fill', selector: '#place-order-address1', value: shopOrder.address1 },
    { type: 'fill', selector: '#place-order-address2', value: shopOrder.address2 },
    { type: 'fill', selector: '#place-order-city', value: shopOrder.city },
    { type: 'select', selector: '#place-order-region', value: shopOrder.region },
    { type: 'fill', selector: '#place-order-postal', value: shopOrder.postal },
    { type: 'select', selector: '#place-order-shipping', value: shopOrder.shipping },
    { type: 'fill', selector: '#place-order-cardName', value: shopOrder.cardName },
    { type: 'fill', selector: '#place-order-cardNumber', value: shopOrder.cardNumber },
    { type: 'fill', selector: '#place-order-exp', value: shopOrder.exp },
    { type: 'fill', selector: '#place-order-cvc', value: shopOrder.cvc },
    { type: 'fill', selector: '#place-order-notes', value: shopOrder.notes },
    { type: 'check', selector: '#place-order-terms' },
    { type: 'click', selector: '#place-order button[type=submit]' },
  ],
}

const BOOKS = [
  { id: 'left-hand', title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin' },
  { id: 'kindred', title: 'Kindred', author: 'Octavia E. Butler' },
  { id: 'dispossessed', title: 'The Dispossessed', author: 'Ursula K. Le Guin' },
]

const library: SiteDefinition = {
  id: 'library',
  title: 'Harbor Library',
  kicker: 'Demo library',
  accent: '#1d4e89',
  intro: 'Search the shelf, then reserve a copy with a library card.',
  initialView: 'search',
  nav: [
    { id: 'search', label: 'Search' },
    { id: 'reserve', label: 'Reserve' },
  ],
  views: [
    {
      id: 'search',
      html: `
        <h2>Search the shelf</h2>
        ${formOpen({ id: 'search-books', title: 'Search books', endpoint: '/api/books', method: 'GET', transport: 'xhr', result: 'book-results' })}
          ${control({ formId: 'search-books', name: 'q', label: 'Title or author', required: true })}
          <button type="submit">Search</button>
        </form>
        <div id="book-results" class="results"></div>
      `,
    },
    {
      id: 'reserve',
      html: `
        <h2>Reserve a copy</h2>
        ${formOpen({ id: 'place-hold', title: 'Place hold', endpoint: '/api/holds', method: 'POST', transport: 'fetch', result: 'outcome' })}
          ${control({
            formId: 'place-hold',
            name: 'bookId',
            label: 'Book',
            required: true,
            options: BOOKS.map((book) => ({ value: book.id, label: book.title })),
          })}
          ${control({ formId: 'place-hold', name: 'card', label: 'Card number', required: true })}
          ${control({ formId: 'place-hold', name: 'name', label: 'Name on card', required: true })}
          <button type="submit">Place hold</button>
        </form>
      `,
    },
    { id: 'done', html: `<h2>Hold confirmed</h2><div id="outcome"></div>` },
  ],
  handlers: {
    'GET /api/books': ({ query }) => {
      const q = (query.get('q') ?? '').trim().toLowerCase()
      const books = BOOKS.filter(
        (book) => q === '' || book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q),
      )
      return { status: 200, body: { books } }
    },
    'POST /api/holds': ({ body, state }) => {
      const book = BOOKS.find((item) => item.id === body.bookId)
      if (!book) return bad('Unknown book')
      if (typeof body.card !== 'string' || !/^\d{6}$/.test(body.card)) return bad('Card number must be 6 digits')
      if (typeof body.name !== 'string' || body.name.trim() === '') return bad('Name is required')
      const id = `HL-${500 + state.seq}`
      state.seq += 1
      return { status: 201, body: { hold: { id, bookId: book.id, name: body.name } } }
    },
  },
  flow: [
    { type: 'fill', selector: '#search-books-q', value: 'left hand' },
    { type: 'click', selector: '#search-books button[type=submit]' },
    { type: 'click', selector: '[data-nav=reserve]' },
    { type: 'select', selector: '#place-hold-bookId', value: 'left-hand' },
    { type: 'fill', selector: '#place-hold-card', value: '440011' },
    { type: 'fill', selector: '#place-hold-name', value: 'June Harlow' },
    { type: 'click', selector: '#place-hold button[type=submit]' },
  ],
}

const ARTICLES = [
  { id: 'refunds', title: 'Refunds and returns' },
  { id: 'shipping', title: 'Shipping times' },
  { id: 'warranty', title: 'Warranty claims' },
]

const support: SiteDefinition = {
  id: 'support',
  title: 'Lumen Desk',
  kicker: 'Demo support desk',
  accent: '#7c4a2d',
  intro: 'Look up an article, then file a ticket. Nothing leaves this machine.',
  initialView: 'search',
  nav: [
    { id: 'search', label: 'Articles' },
    { id: 'ticket', label: 'Ticket' },
  ],
  views: [
    {
      id: 'search',
      html: `
        <h2>Articles</h2>
        ${formOpen({ id: 'search-articles', title: 'Search articles', endpoint: '/api/articles', method: 'GET', transport: 'fetch', result: 'article-results' })}
          ${control({ formId: 'search-articles', name: 'q', label: 'Question', required: true })}
          <button type="submit">Search</button>
        </form>
        <div id="article-results" class="results"></div>
      `,
    },
    {
      id: 'ticket',
      html: `
        <h2>File a ticket</h2>
        ${formOpen({ id: 'file-ticket', title: 'File ticket', endpoint: '/api/tickets', method: 'POST', transport: 'xhr', result: 'outcome' })}
          ${control({ formId: 'file-ticket', name: 'email', label: 'Email', type: 'email', required: true })}
          ${control({ formId: 'file-ticket', name: 'subject', label: 'Subject', required: true })}
          ${control({ formId: 'file-ticket', name: 'body', label: 'What happened', type: 'textarea', required: true })}
          <button type="submit">File ticket</button>
        </form>
      `,
    },
    { id: 'done', html: `<h2>Ticket filed</h2><div id="outcome"></div>` },
  ],
  handlers: {
    'GET /api/articles': ({ query }) => {
      const q = (query.get('q') ?? '').trim().toLowerCase()
      const articles = ARTICLES.filter((article) => q === '' || article.title.toLowerCase().includes(q))
      return { status: 200, body: { articles } }
    },
    'POST /api/tickets': ({ body, state }) => {
      if (typeof body.email !== 'string' || !body.email.includes('@')) return bad('Email is required')
      if (typeof body.subject !== 'string' || body.subject.trim() === '') return bad('Subject is required')
      if (typeof body.body !== 'string' || body.body.trim() === '') return bad('Details are required')
      const id = `LD-${800 + state.seq}`
      state.seq += 1
      return { status: 201, body: { ticket: { id, email: body.email, subject: body.subject } } }
    },
  },
  flow: [
    { type: 'fill', selector: '#search-articles-q', value: 'refund' },
    { type: 'click', selector: '#search-articles button[type=submit]' },
    { type: 'click', selector: '[data-nav=ticket]' },
    { type: 'fill', selector: '#file-ticket-email', value: 'ada@analytical.example' },
    { type: 'fill', selector: '#file-ticket-subject', value: 'Mug arrived cracked' },
    { type: 'fill', selector: '#file-ticket-body', value: 'The cedar mug arrived with a crack along the glaze.' },
    { type: 'click', selector: '#file-ticket button[type=submit]' },
  ],
}

const SLOTS = [
  { id: 'tue-0900', service: 'cleaning', label: 'Tue 09:00' },
  { id: 'tue-1300', service: 'cleaning', label: 'Tue 13:00' },
  { id: 'wed-1000', service: 'exam', label: 'Wed 10:00' },
]

const booking: SiteDefinition = {
  id: 'booking',
  title: 'Cedar Clinic',
  kicker: 'Demo clinic',
  accent: '#0f6e73',
  intro: 'Check open slots, then book a visit. The calendar is local mock data.',
  initialView: 'slots',
  nav: [
    { id: 'slots', label: 'Slots' },
    { id: 'book', label: 'Book' },
  ],
  views: [
    {
      id: 'slots',
      html: `
        <h2>Open slots</h2>
        ${formOpen({ id: 'search-slots', title: 'Search slots', endpoint: '/api/slots', method: 'GET', transport: 'fetch', result: 'slot-results' })}
          ${control({
            formId: 'search-slots',
            name: 'service',
            label: 'Service',
            required: true,
            options: [
              { value: 'cleaning', label: 'Cleaning' },
              { value: 'exam', label: 'Exam' },
            ],
          })}
          <button type="submit">Show slots</button>
        </form>
        <div id="slot-results" class="results"></div>
      `,
    },
    {
      id: 'book',
      html: `
        <h2>Book a visit</h2>
        ${formOpen({ id: 'book-visit', title: 'Book visit', endpoint: '/api/appointments', method: 'POST', transport: 'xhr', result: 'outcome' })}
          ${control({
            formId: 'book-visit',
            name: 'service',
            label: 'Service',
            required: true,
            options: [
              { value: 'cleaning', label: 'Cleaning' },
              { value: 'exam', label: 'Exam' },
            ],
          })}
          ${control({
            formId: 'book-visit',
            name: 'slot',
            label: 'Slot',
            required: true,
            options: SLOTS.map((slot) => ({ value: slot.id, label: `${slot.label} (${slot.service})` })),
          })}
          ${control({ formId: 'book-visit', name: 'patient', label: 'Patient', required: true })}
          ${control({ formId: 'book-visit', name: 'email', label: 'Email', type: 'email', required: true })}
          <button type="submit">Book visit</button>
        </form>
      `,
    },
    { id: 'done', html: `<h2>Visit booked</h2><div id="outcome"></div>` },
  ],
  handlers: {
    'GET /api/slots': ({ query }) => {
      const service = query.get('service') ?? ''
      const slots = SLOTS.filter((slot) => slot.service === service)
      return { status: 200, body: { slots } }
    },
    'POST /api/appointments': ({ body, state }) => {
      const slot = SLOTS.find((item) => item.id === body.slot)
      if (!slot) return bad('Unknown slot')
      if (slot.service !== body.service) return bad('Slot does not match the service')
      if (typeof body.patient !== 'string' || body.patient.trim() === '') return bad('Patient is required')
      if (typeof body.email !== 'string' || !body.email.includes('@')) return bad('Email is required')
      const id = `CV-${300 + state.seq}`
      state.seq += 1
      return {
        status: 201,
        body: { appointment: { id, service: slot.service, slot: slot.id, patient: body.patient, email: body.email } },
      }
    },
  },
  flow: [
    { type: 'select', selector: '#search-slots-service', value: 'cleaning' },
    { type: 'click', selector: '#search-slots button[type=submit]' },
    { type: 'click', selector: '[data-nav=book]' },
    { type: 'select', selector: '#book-visit-service', value: 'cleaning' },
    { type: 'select', selector: '#book-visit-slot', value: 'tue-0900' },
    { type: 'fill', selector: '#book-visit-patient', value: 'Ada Lovelace' },
    { type: 'fill', selector: '#book-visit-email', value: 'ada@analytical.example' },
    { type: 'click', selector: '#book-visit button[type=submit]' },
  ],
}

const MENU = [
  { id: 'lentil', name: 'Lentil Stew', diet: 'vegetarian', price: 12 },
  { id: 'trout', name: 'Pan Trout', diet: 'fish', price: 19 },
  { id: 'greens', name: 'Sesame Greens', diet: 'vegetarian', price: 9 },
]

const pantry: SiteDefinition = {
  id: 'pantry',
  title: 'Weeknight Pantry',
  kicker: 'Demo kitchen',
  accent: '#9a3412',
  intro: 'Filter the menu, then place a pickup order.',
  initialView: 'menu',
  nav: [
    { id: 'menu', label: 'Menu' },
    { id: 'order', label: 'Order' },
  ],
  views: [
    {
      id: 'menu',
      html: `
        <h2>Menu</h2>
        ${formOpen({ id: 'search-menu', title: 'Search menu', endpoint: '/api/menu', method: 'GET', transport: 'fetch', result: 'menu-results' })}
          ${control({
            formId: 'search-menu',
            name: 'diet',
            label: 'Diet',
            required: true,
            options: [
              { value: 'vegetarian', label: 'Vegetarian' },
              { value: 'fish', label: 'Fish' },
            ],
          })}
          <button type="submit">Show dishes</button>
        </form>
        <div id="menu-results" class="results"></div>
      `,
    },
    {
      id: 'order',
      html: `
        <h2>Pickup order</h2>
        ${formOpen({ id: 'place-pantry-order', title: 'Place pantry order', endpoint: '/api/orders', method: 'POST', transport: 'fetch', result: 'outcome' })}
          ${control({
            formId: 'place-pantry-order',
            name: 'item',
            label: 'Dish',
            required: true,
            options: MENU.map((item) => ({ value: item.id, label: item.name })),
          })}
          ${control({ formId: 'place-pantry-order', name: 'qty', label: 'Quantity', type: 'number', required: true, min: 1, max: 6 })}
          ${control({ formId: 'place-pantry-order', name: 'name', label: 'Name', required: true })}
          ${control({ formId: 'place-pantry-order', name: 'phone', label: 'Phone', type: 'tel', required: true })}
          <button type="submit">Place order</button>
        </form>
      `,
    },
    { id: 'done', html: `<h2>Order placed</h2><div id="outcome"></div>` },
  ],
  handlers: {
    'GET /api/menu': ({ query }) => {
      const diet = query.get('diet') ?? ''
      const items = MENU.filter((item) => item.diet === diet)
      return { status: 200, body: { items } }
    },
    'POST /api/orders': ({ body, state }) => {
      const item = MENU.find((dish) => dish.id === body.item)
      if (!item) return bad('Unknown dish')
      const qty = Number(body.qty)
      if (!Number.isInteger(qty) || qty < 1 || qty > 6) return bad('Quantity must be from 1 to 6')
      if (typeof body.name !== 'string' || body.name.trim() === '') return bad('Name is required')
      if (typeof body.phone !== 'string' || body.phone.trim() === '') return bad('Phone is required')
      const id = `WP-${700 + state.seq}`
      state.seq += 1
      return {
        status: 201,
        body: { receipt: { id, item: item.id, qty, name: body.name, total: item.price * qty } },
      }
    },
  },
  flow: [
    { type: 'select', selector: '#search-menu-diet', value: 'vegetarian' },
    { type: 'click', selector: '#search-menu button[type=submit]' },
    { type: 'click', selector: '[data-nav=order]' },
    { type: 'select', selector: '#place-pantry-order-item', value: 'lentil' },
    { type: 'fill', selector: '#place-pantry-order-qty', value: '2' },
    { type: 'fill', selector: '#place-pantry-order-name', value: 'Ada Lovelace' },
    { type: 'fill', selector: '#place-pantry-order-phone', value: '206-555-0142' },
    { type: 'click', selector: '#place-pantry-order button[type=submit]' },
  ],
}

export const sites: SiteDefinition[] = [shop, library, support, booking, pantry]

export function getSite(id: string): SiteDefinition {
  const site = sites.find((item) => item.id === id)
  if (!site) throw new Error(`Unknown site ${id}`)
  return site
}
