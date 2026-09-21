import { defineConfig } from 'vite'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ArrowLeft, ArrowUpRight, Camera, Download, LogOut, Mail, RotateCw, X, TriangleAlert, ShieldCheck, Search, Heart, Smartphone } from 'lucide-react'

const icons = { close: X, back: ArrowLeft, download: Download, logout: LogOut, mail: Mail, refresh: RotateCw, warning: TriangleAlert, shield: ShieldCheck, search: Search, heart: Heart, phone: Smartphone, forward: ArrowUpRight, upload: Camera }

export default defineConfig({
  plugins: [{
    name: 'lucide-icons',
    // Render the React icons into HTML without adding React to the browser bundle.
    transformIndexHtml(html) {
      for (const [name, icon] of Object.entries(icons)) {
        html = html.replaceAll(`<span data-icon="${name}"></span>`, renderToStaticMarkup(createElement(icon, {
          size: 18, strokeWidth: 1.75, 'aria-hidden': true, focusable: false,
        })))
      }
      return html
    },
  }],
  build: {
    rollupOptions: { input: { main: 'index.html', admin: 'admin.html', spending: 'spending.html' } },
  },
})
