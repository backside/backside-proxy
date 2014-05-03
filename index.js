var http = require("http")
var shoe = require("shoe")
var Proxy = require("./lib/proxy")
var net = require("net")

function makeRabbitSock() {
  return net.connect({host: "localhost", port: "61613"})
}

var sock = shoe(function(conn) {
  var sConn = makeRabbitSock()
  var proxy = new Proxy(conn, sConn)
  sConn.on("connect", function() {
    proxy.start()
    console.log("rabbit is open")
  })

  proxy.on("severClose", function() {
    console.log("server closed!")
  })
  proxy.on("clientClose", function() {
    console.log("client closed!")
  })
  proxy.on("error", function(err) {
    console.log("received fatal error from proxy", err.message)
  })
})

var app = http.createServer()
sock.install(app, "/foo")
app.listen(4000, function() {
  console.log("listening")
})

