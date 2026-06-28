const { randomUUID } = require('crypto');

const v4 = () => randomUUID();

module.exports = {
  v4,
  default: v4,
};
