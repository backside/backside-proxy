var net = require("net")

module.exports = function(STOMP_HOST, STOMP_PORT) {
  return {
    createConnection: function() {
      return net.connect({host: STOMP_HOST, port: STOMP_PORT})
    }
  }
}
