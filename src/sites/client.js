// Copyright 2026 WebMCP-Retrofit contributors. Apache-2.0.
;(function () {
  const config = JSON.parse(document.getElementById('site-config').textContent)

  function show(view) {
    document.querySelectorAll('[data-view]').forEach((el) => {
      el.hidden = el.getAttribute('data-view') !== view
    })
    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.setAttribute('aria-current', el.getAttribute('data-nav') === view ? 'page' : 'false')
    })
  }

  function readForm(form) {
    const data = {}
    for (const el of form.elements) {
      if (!el.name || el.disabled) continue
      if (el.type === 'submit' || el.type === 'button') continue
      if (el.type === 'checkbox') {
        data[el.name] = el.checked
        continue
      }
      if (el.type === 'radio' && !el.checked) continue
      if (el.value === '' && !el.required) continue
      if (el.type === 'number' || el.dataset.valueType === 'number') data[el.name] = Number(el.value)
      else data[el.name] = el.value
    }
    return data
  }

  function request(transport, method, url, body) {
    if (transport === 'xhr') {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open(method, url)
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.setRequestHeader('X-Retrofit-Transport', 'xhr')
        xhr.onload = () => {
          let parsed = null
          try {
            parsed = JSON.parse(xhr.responseText)
          } catch {
            parsed = { error: xhr.responseText }
          }
          resolve({ status: xhr.status, body: parsed })
        }
        xhr.onerror = () => reject(new Error('xhr failed'))
        xhr.send(body == null ? null : JSON.stringify(body))
      })
    }
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Retrofit-Transport': 'fetch',
      },
      body: body == null ? undefined : JSON.stringify(body),
    }).then(async (res) => {
      let parsed = null
      try {
        parsed = await res.json()
      } catch {
        parsed = null
      }
      return { status: res.status, body: parsed }
    })
  }

  function element(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text != null) node.textContent = text
    return node
  }

  function copyLine(line) {
    const form = document.getElementById('place-order')
    if (!form) return
    for (const key of ['sku', 'size', 'glaze', 'qty']) {
      const input = form.elements.namedItem(key)
      if (input && line[key] != null) input.value = String(line[key])
    }
    const note = document.getElementById('checkout-line')
    if (note) note.textContent = `${line.qty} × ${line.name} (${line.size}, ${line.glaze}) · $${line.lineTotal}`
  }

  function renderList(node, rows, textOf) {
    node.replaceChildren()
    if (!rows.length) {
      node.append(element('p', '', 'Nothing matched.'))
      return
    }
    for (const row of rows) node.append(textOf(row))
  }

  function renderResult(result) {
    const body = result.body || {}
    if (result.status >= 400) {
      const alert = document.getElementById('form-alert') || document.querySelector('main')
      const message = element('p', 'error', body.error || 'Request failed')
      message.setAttribute('role', 'alert')
      alert.prepend(message)
      return
    }
    if (Array.isArray(body.products)) {
      const node = document.getElementById('search-results')
      renderList(node, body.products, (product) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'card'
        button.setAttribute('data-open-product', product.sku)
        button.append(element('span', 'card-title', product.name))
        button.append(element('span', 'card-meta', `${product.category} · $${product.price}`))
        return button
      })
      return
    }
    if (Array.isArray(body.books)) {
      renderList(document.getElementById('book-results'), body.books, (book) =>
        element('p', 'card', `${book.title} — ${book.author}`),
      )
      return
    }
    if (Array.isArray(body.articles)) {
      renderList(document.getElementById('article-results'), body.articles, (article) =>
        element('p', 'card', article.title),
      )
      return
    }
    if (Array.isArray(body.slots)) {
      renderList(document.getElementById('slot-results'), body.slots, (slot) =>
        element('p', 'card', `${slot.label} · ${slot.service}`),
      )
      return
    }
    if (Array.isArray(body.items)) {
      renderList(document.getElementById('menu-results'), body.items, (item) =>
        element('p', 'card', `${item.name} · $${item.price}`),
      )
      return
    }
    if (body.line) {
      const node = document.getElementById('cart-summary')
      node.replaceChildren(
        element('p', 'card', `${body.line.qty} × ${body.line.name} (${body.line.size}, ${body.line.glaze})`),
        element('p', '', `Line total $${body.line.lineTotal}`),
      )
      copyLine(body.line)
      return
    }
    const outcome = body.order || body.hold || body.ticket || body.appointment || body.receipt
    if (outcome) {
      const done = document.getElementById('outcome')
      done.replaceChildren()
      done.append(element('p', 'outcome-kicker', 'Confirmed'))
      done.append(element('p', 'outcome-id', outcome.id))
      const list = document.createElement('dl')
      for (const [key, value] of Object.entries(outcome)) {
        if (key === 'id') continue
        const row = document.createElement('div')
        row.append(element('dt', '', key))
        row.append(element('dd', '', String(value)))
        list.append(row)
      }
      done.append(list)
      done.dataset.outcomeJson = JSON.stringify(outcome)
      show('done')
    }
  }

  document.addEventListener('submit', async (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement) || !form.dataset.endpoint) return
    event.preventDefault()
    const method = (form.dataset.method || 'POST').toUpperCase()
    const transport = form.dataset.transport || 'fetch'
    const data = readForm(form)
    let url = form.dataset.endpoint
    let body = data
    if (method === 'GET') {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(data)) params.set(key, String(value))
      url = `${url}?${params.toString()}`
      body = null
    }
    const result = await request(transport, method, url, body)
    renderResult(result)
  })

  document.addEventListener('click', (event) => {
    const nav = event.target.closest('[data-nav]')
    if (nav) {
      event.preventDefault()
      show(nav.getAttribute('data-nav'))
      return
    }
    const open = event.target.closest('[data-open-product]')
    if (!open) return
    const sku = open.getAttribute('data-open-product')
    const select = document.querySelector('#add-to-cart [name="sku"]')
    if (select) select.value = sku
    const heading = document.getElementById('product-heading')
    const title = open.querySelector('.card-title')
    if (heading) heading.textContent = title ? title.textContent : sku
    show('product')
  })

  show(config.initialView)
  window.__site = { show }
})()
