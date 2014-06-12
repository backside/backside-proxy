var net = require("net")
var http = require("http")
var shoe = require("shoe")
var config = require("./config")

function createServers(overrideConfig, cb) {
  if (typeof overrideConfig === "function") {
    cb = overrideConfig
    overrideConfig = null
  }
  config = overrideConfig || config

  config.resolve(function(proxy, SOCK_PREFIX, logger) {
    function onConnection(proto, conn) {
      var p = proxy.createProxy(conn)
      logger.log("info", "accepted new " + proto + " connection")

      p.on("severClose", function() {
        logger.log("info", "stomp server closed connection")
      })
      p.on("clientClose", function() {
        logger.log("info", "client closed connection")
      })
      p.on("error", function(err) {
        logger.log("warn", "received fatal error from proxy " + err.message)
      })
    }
    var wsServer = shoe(onConnection.bind(null, "websocket"))
    var app = http.createServer()
    wsServer.install(app, SOCK_PREFIX)
    var tcpServer = net.createServer(onConnection.bind(null, "tcp"))
    cb(null, {ws: app, tcp: tcpServer})
  })
}
module.exports = {
  createServers: createServers,
  getContainer: function() {
    return container
  }
}


if (module === require.main) {
  var PORT = config.get("PORT")
  var SOCK_PREFIX = config.get("SOCK_PREFIX")
  var TCP_PORT = config.get("TCP_PORT")
  var logger = config.get("logger")

  var servers = createServers(function(err, servers) {
    if (err) throw err
    if (PORT) {
      servers.ws.listen(PORT, function() {
        logger.log("info", "websocket server started on " + PORT + " at path " + SOCK_PREFIX)
      })
    }
    if (TCP_PORT) {
      servers.tcp.listen(TCP_PORT, function() {
        logger.log("info", "tcp server started on " + TCP_PORT)
      })
    }
  })
}
