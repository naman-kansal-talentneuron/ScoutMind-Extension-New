const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      background: './background/index.js',
      content: './content/index.js',
      popup: './popup/popup.js',
      settings: './settings/settings.js',
      // Add other entry points if needed (e.g., offscreen.js)
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].bundle.js',
      clean: true, // Clean the output directory before each build
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react']
            }
          }
        },
        {
          test: /\.css$/i,
          include: path.resolve(__dirname, 'popup/styles'), // Or wherever your main CSS is
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
        // Add loaders for other asset types if needed (e.g., images, fonts)
      ],
    },
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './popup/popup.html',
        filename: 'popup.html',
        chunks: ['popup'], // Only include the popup bundle
      }),
      new HtmlWebpackPlugin({
        template: './settings/settings.html',
        filename: 'settings.html',
        chunks: ['settings'], // Only include the settings bundle
      }),
      // Add HtmlWebpackPlugin for offscreen.html if you have one
      new CopyWebpackPlugin({
        patterns: [
          { from: 'manifest.json', to: 'manifest.json' },
          { from: 'assets', to: 'assets' },
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
