import * as stylex from '@stylexjs/stylex'
import type { Metadata } from 'next'
import { Geist, Geist_Mono, STIX_Two_Text } from 'next/font/google'
import { THEME_CLASS } from './theme-class'
import { t } from './tokens.stylex'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
const stix = STIX_Two_Text({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-stix' })

export const metadata: Metadata = { title: 'Unstoppable Math', icons: { icon: '/favicon.svg' } }

const s = stylex.create({
  html: {
    backgroundColor: t.void,
    overscrollBehavior: 'none',
    overflowX: 'clip',
    '--um-ink': t.ink,
  },
  body: {
    margin: 0,
    backgroundColor: t.void,
    color: t.ink,
    fontFamily: t.sans,
    WebkitFontSmoothing: 'antialiased',
    textRendering: 'optimizeLegibility',
  },
})

const bootTheme = `(function(){var c=${JSON.stringify(THEME_CLASS)};var t='paper';try{var s=localStorage.getItem('um.theme');if(s&&Object.prototype.hasOwnProperty.call(c,s))t=s}catch(e){}if(t==='paper')return;var h=document.documentElement;var old=c.paper;if(old)for(var i=0,p=old.split(' ');i<p.length;i++)h.classList.remove(p[i]);if(t==='classic')h.removeAttribute('data-theme');else h.setAttribute('data-theme',t);var k=c[t];if(k)for(var j=0,q=k.split(' ');j<q.length;j++)h.classList.add(q[j])})()`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  const html = stylex.props(s.html)
  return (
    <html
      lang="en"
      data-theme="paper"
      suppressHydrationWarning
      className={[geist.variable, geistMono.variable, stix.variable, html.className, THEME_CLASS.paper]
        .filter(Boolean)
        .join(' ')}
      style={html.style}
    >
      <body {...stylex.props(s.body)}>
        <script dangerouslySetInnerHTML={{ __html: bootTheme }} />
        {children}
      </body>
    </html>
  )
}
