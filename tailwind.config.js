/**
 * Theme colors are CSS custom properties (see src/styles/globals.css), so one
 * set of utilities serves every theme.
 *
 * Each color is wrapped in color-mix() with Tailwind's <alpha-value>
 * placeholder. Without it, opacity modifiers such as `bg-accent/10` cannot be
 * applied to a `var(--…)` color and Tailwind silently emits no CSS at all.
 */
const token = (name) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: token("--bg"),
        surface: {
          DEFAULT: token("--surface"),
          2: token("--surface-2"),
          3: token("--surface-3"),
        },
        overlay: token("--overlay"),
        fg: {
          DEFAULT: token("--fg"),
          muted: token("--fg-muted"),
          subtle: token("--fg-subtle"),
        },
        line: {
          DEFAULT: token("--line"),
          strong: token("--line-strong"),
        },
        accent: {
          DEFAULT: token("--accent"),
          // Aliases kept for components that predate the token rename.
          primary: token("--accent"),
          secondary: token("--accent-2"),
          fg: token("--on-accent"),
        },
        success: token("--success"),
        warning: token("--warning"),
        danger: token("--danger"),
        error: token("--danger"),
        code: {
          block: token("--code-bg"),
          text: token("--code-fg"),
        },
        // Legacy names, mapped onto the new tokens.
        bg: {
          primary: token("--bg"),
          secondary: token("--surface"),
          tertiary: token("--surface-2"),
        },
        text: {
          primary: token("--fg"),
          secondary: token("--fg-muted"),
          tertiary: token("--fg-subtle"),
        },
        border: token("--line"),
      },
      // Preflight gives a bare `border` Tailwind's gray-200, which glows on
      // dark themes. Default every border to the theme's hairline instead.
      borderColor: {
        DEFAULT: "var(--line)",
      },
      fontFamily: {
        sans: ["Geist Variable", "Segoe UI Variable Text", "Segoe UI", "system-ui", "sans-serif"],
        display: ["Instrument Serif", "Georgia", "serif"],
        mono: ["Geist Mono Variable", "JetBrains Mono", "Consolas", "monospace"],
      },
      // Finer steps for subtle tints (`bg-accent/12`).
      opacity: {
        6: "0.06",
        8: "0.08",
        12: "0.12",
        14: "0.14",
        18: "0.18",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        65: "0.65",
        85: "0.85",
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      boxShadow: {
        pop: "var(--shadow-pop)",
        panel: "var(--shadow-panel)",
        soft: "var(--shadow-soft)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};
