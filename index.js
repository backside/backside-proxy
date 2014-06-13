var path = require("path")
var net = require("net")
var http = require("http")
var shoe = require("shoe")
var container = require("./config")

function createServers(overrideConfig) {
  container = overrideConfig || container

  var SOCK_PREFIX = container.get("SOCK_PREFIX")
  var logger = container.get("logger")
  var proxy = container.get("proxy")

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
}

module.exports = {
  createServers: createServers,
  getContainer: function() {
    return container
  }
}


if (module === require.main) {
  if (process.argv[2]) {
    var userConfig = require(path.join(process.cwd(), process.argv[2]))
    userConfig.configure(container)
  }
  var WS_PORT = container.get("WS_PORT")
  var SOCK_PREFIX = container.get("SOCK_PREFIX")
  var TCP_PORT = container.get("TCP_PORT")
  var logger = container.get("logger")

  var servers = createServers()
  if (WS_PORT) {
    servers.ws.listen(WS_PORT, function() {
      logger.log("info", "websocket server started on " + WS_PORT + " at path " + SOCK_PREFIX)
    })
  }
  if (TCP_PORT) {
    servers.tcp.listen(TCP_PORT, function() {
      logger.log("info", "tcp server started on " + TCP_PORT)
    })
  }
}
