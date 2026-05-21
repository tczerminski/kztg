const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {},
  output: {
    path: path.resolve(__dirname, "dist"),
    clean: false,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "index.html",
          to: "index.html",
          transform(content) {
            return Buffer.from(
              content
                .toString()
                .replaceAll('href="./dist/style.css"', 'href="/style.css"')
                .replaceAll('href="/dist/style.css"', 'href="/style.css"')
                .replaceAll('href="/dist/index.js"', 'href="/index.js"')
                .replaceAll('src="dist/index.js"', 'src="/index.js"')
                .replaceAll('href="/dist/"', 'href="/"')
                .replaceAll('src="/dist/"', 'src="/"'),
            );
          },
        },
        {
          from: "images/icons",
          to: "images/icons",
        },
        {
          from: "images/logo.jpg",
          to: "images/logo.jpg",
        },
        {
          from: "images/hero-optimized.jpg",
          to: "images/hero-optimized.jpg",
        },
        {
          from: "images/hero-optimized.webp",
          to: "images/hero-optimized.webp",
        },
        {
          from: "images/hero2-optimized.jpg",
          to: "images/hero2-optimized.jpg",
        },
        {
          from: "images/hero2-optimized.webp",
          to: "images/hero2-optimized.webp",
        },
        {
          from: "fonts",
          to: "fonts",
        },
      ],
    }),
  ],
};
