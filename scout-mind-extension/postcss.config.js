module.exports = {
  plugins: {
    tailwindcss: {
      // Ensure the config path is correct if tailwind.config.js is not in the same directory as postcss.config.js
      // config: './tailwind.config.js' // Usually not needed if they are siblings
    },
    autoprefixer: {},
  },
}
