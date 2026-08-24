module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const findAndPatch = (rules) => {
        for (const rule of rules) {
          if (rule.oneOf) findAndPatch(rule.oneOf);
          if (
            rule.enforce === 'pre' &&
            rule.loader &&
            rule.loader.includes('source-map-loader')
          ) {
            rule.exclude = /node_modules/;
          }
        }
      };
      findAndPatch(webpackConfig.module.rules);
      return webpackConfig;
    },
  },
};
