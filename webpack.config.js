const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const src = path.join(__dirname, 'demo');
const dist = path.join(__dirname, '.tmp');

module.exports = {
  entry: {
    app: path.join(src, './index.js')
  },
  devtool: 'inline-source-map',
  devServer: {
    contentBase: dist,
    port: 8000,
    allowedHosts: ['local.arduino.cc']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(src, 'index.html')
    })
  ],
  output: {
    filename: '[name].bundle.js',
    path: dist
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              { plugins: ['@babel/plugin-proposal-class-properties'] }
            ]

            // presets: ['@babel/preset-env',
            //   {
            //     plugins: [
            //       '@babel/plugin-proposal-class-properties'
            //     ]
            //   }
            // ],
          }
        }
      }
    ]
  }
};
