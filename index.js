var net = require("net")
var http = require("http")
var shoe = require("shoe")
var config = require("./config")

exports.createServers = function(overrideConfig) {
  config = overrideConfig || config

  return config.resolve(function(proxy, SOCK_PREFIX, logger) {
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
    return {ws: app, tcp: tcpServer}
  })
}

if (module === require.main) {
  var PORT = config.get("PORT")
  var SOCK_PREFIX = config.get("SOCK_PREFIX")
  var TCP_PORT = config.get("TCP_PORT")
  var logger = config.get("logger")

  var servers = exports.createServers()
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
}
