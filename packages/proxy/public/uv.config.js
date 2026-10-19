self.__uv$config = {
  prefix: '/uv/service/',
  encodeUrl: (url) => encodeURIComponent(url),
  decodeUrl: (url) => decodeURIComponent(url),
  bundle: '/uv/uv.bundle.js',
  config: '/uv/uv.config.js',
  handler: '/uv/uv.handler.js',
  client: '/uv/uv.client.js',
  sw: '/uv/uv.sw.js',
};
