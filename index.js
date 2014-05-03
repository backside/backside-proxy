var http = require("http")
var shoe = require("shoe")
var Proxy = require("./lib/proxy")
var net = require("net")

function makeRabbitSock(cb) {
  var sConn = net.connect({host: "localhost", port: "61613"}, function(err) {
    cb(err, sConn)
  })
  return sConn
}

var sConn = makeRabbitSock(function(err, sConn) {
  if (err) {
    throw err
  }
  console.log("rabbit is open")
})
var sock = shoe(function(conn) {
  var proxy = new Proxy(conn, sConn)
  proxy.on("close", function() {
    console.log("it closed!")
  })
  proxy.on("error", function(err) {
    throw err
  })
})

sock.on("log", function(log) {
  console.log("from ze websocket", log)
})

var app = http.createServer()
sock.install(app, "/foo")
app.listen(4000, function() {
  console.log("listening")
})

