const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      background: './scout-mind-extension/src/background/background.ts',
      content: './scout-mind-extension/src/content/content.ts',
      popup: './scout-mind-extension/src/popup/popup.tsx',
      options: './scout-mind-extension/src/options/options.tsx',
      offscreen: './scout-mind-extension/src/offscreen/offscreen.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].bundle.js',
      clean: true, // Clean the output directory before each build
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/, // Added ts|tsx
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'] // Added @babel/preset-typescript
            }
          }
        },
        {
          test: /\.css$/i,
          // Assuming Tailwind will be set up for scout-mind-extension later,
          // for now, this rule might not be immediately used by empty TSX files, or could point to a global style.
          // If scout-mind-extension has its own main CSS, adjust 'include'.
          // For now, keep as is or make it more general if needed:
          // include: path.resolve(__dirname, 'scout-mind-extension/src/popup/styles'), 
          use: ['style-loader', 'css-loader', 'postcss-loader'], // Ensure postcss-loader is for Tailwind
        },
      ],
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'], // Added .ts, .tsx
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './scout-mind-extension/src/popup/popup.html', // Path to new template
        filename: 'popup.html',
        chunks: ['popup'],
      }),
      new HtmlWebpackPlugin({
        template: './scout-mind-extension/src/options/options.html', // Path to new template
        filename: 'options.html', // Output options.html
        chunks: ['options'], 
      }),
      new HtmlWebpackPlugin({
        template: './scout-mind-extension/public/offscreen.html',
        filename: 'offscreen.html',
        chunks: ['offscreen'], // Only include offscreen.bundle.js
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: './scout-mind-extension/src/manifest.json', to: 'manifest.json' },
          { from: 'assets', to: 'assets' }, // Assuming global assets for now
          // Add other static assets if needed (e.g., offscreen.html)
        ],
      }),
    ],
    devtool: isProduction ? false : 'cheap-module-source-map', // Source maps for development
    performance: {
      hints: isProduction ? 'warning' : false, // Performance hints in production
    },
    // Optimization settings can be added here for production builds
    // optimization: { ... },
  };
};
