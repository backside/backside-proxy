
var net = require("net")
var Frame = require("stompjs").Frame
var server = net.createServer(function(conn) {
  conn.on("data", function(data) {
    if (typeof data !== "string") {
      data = data.toString()
    }
    var frames = Frame.unmarshall(data)

    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i]
      console.log(frame)

      switch (frame.command) {
        case "CONNECT":
          var rframe = new Frame("CONNECTED", {"version":"1.1"}, "")
          conn.write(rframe.toString())
          break
        default:
          var rframe = new Frame("MESSAGE", {"version":"1.1", "content-type" : "text/plain"}, frame.body )
          conn.write(rframe.toString())
      }
    }

  })
})

server.listen(process.env.PORT || 61620, function() {
  console.log("mini server listening")
})
