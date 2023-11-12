/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      borderRadius: {
        "4xl": "2.5rem",
      },
      colors: {
        dark1: "#00121b",
        dark2: "#001924",
        dark3: "#00c8f6",
        dark4: "#132e39",
      },
      keyframes: {
        slideRight: {
          "0%": {
            transform: "translateX(-5%)",
            opacity: "0",
          },
          "100%": {
            transform: "translateX(0)",
            opacity: "1",
          },
        },
        slideUp: {
          "0%": {
            transform: "translateY(10%)",
            opacity: "0",
          },
          "100%": {
            transform: "translateX(0)",
            opacity: "1",
          },
        },
      },
      animation: {
        slideRight: "slideRight 1s ease-out",
        slideUp: "slideUp 1s 1s ease-out backwards",
      },
    },
  },
  plugins: [],
};
