module.exports = function(api) {
  api.cache(true);
  
  const plugins = [];
  
  // TODO: Enable console.log removal in production AFTER all features are stable
  // Currently disabled for debugging read receipts and other critical flows
  // if (process.env.NODE_ENV === 'production') {
  //   plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  // }
  
  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};

